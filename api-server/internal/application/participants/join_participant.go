// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package participants

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
)

type JoinParticipantInput struct {
	AppointmentID string
	Nickname      string
	Pin           string
}

type JoinParticipantResult struct {
	ParticipantID string   `json:"participantId"`
	Nickname      string   `json:"nickname"`
	HasPin        bool     `json:"hasPin"`
	SubmittedAt   *string  `json:"submittedAt"`
	Responses     []string `json:"responses"`
}

type JoinParticipantService struct {
	appointments repos.AppointmentRepository
	participants repos.ParticipantRepository
	availability repos.AvailabilityRepository
	metrics      metrics.AppointmentMetrics
	logger       zerolog.Logger
	db           *db.DB
}

func NewJoinParticipantService(
	appointments repos.AppointmentRepository,
	participants repos.ParticipantRepository,
	availability repos.AvailabilityRepository,
	m metrics.AppointmentMetrics,
	logger zerolog.Logger,
	database *db.DB,
) *JoinParticipantService {
	return &JoinParticipantService{
		appointments: appointments,
		participants: participants,
		availability: availability,
		metrics:      m,
		logger:       logger,
		db:           database,
	}
}

func (s *JoinParticipantService) Execute(ctx context.Context, input JoinParticipantInput, requestID string) (*JoinParticipantResult, error) {
	start := time.Now()
	defer func() {
		s.metrics.ObserveParticipantJoin(float64(time.Since(start).Milliseconds()))
	}()

	appointment, err := s.appointments.FindByID(ctx, input.AppointmentID)
	if err != nil {
		s.logger.Error().
			Str("event", "participant.join_failed").
			Str("requestId", requestID).
			Str("appointmentId", input.AppointmentID).
			Err(err).
			Msg("Failed to load appointment for join")
		return nil, application.NewServiceUnavailableError()
	}
	if appointment == nil {
		return nil, application.NewAppointmentNotFoundError()
	}

	participant, err := s.participants.FindByAppointmentAndNickname(ctx, input.AppointmentID, input.Nickname)
	if err != nil {
		s.logger.Error().
			Str("event", "participant.join_failed").
			Str("requestId", requestID).
			Str("appointmentId", input.AppointmentID).
			Err(err).
			Msg("Failed to look up participant")
		return nil, application.NewServiceUnavailableError()
	}

	if participant == nil {
		var pinHash *string
		if input.Pin != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(input.Pin), 10)
			if err != nil {
				s.logger.Error().
					Str("event", "participant.join_failed").
					Str("requestId", requestID).
					Err(err).
					Msg("Failed to hash PIN")
				return nil, application.NewServiceUnavailableError()
			}
			s := string(hash)
			pinHash = &s
		}

		var created repos.ParticipantRecord
		err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
			rec, err := s.participants.Create(ctx, tx, input.AppointmentID, input.Nickname, pinHash)
			if err != nil {
				return err
			}
			created = rec
			return nil
		})
		if err != nil {
			if db.IsUniqueViolation(err) {
				return nil, application.NewNicknameTakenError()
			}
			s.logger.Error().
				Str("event", "participant.join_failed").
				Str("requestId", requestID).
				Str("appointmentId", input.AppointmentID).
				Err(err).
				Msg("Failed to create participant")
			return nil, application.NewServiceUnavailableError()
		}
		participant = &created
	} else if participant.PinHash != nil {
		if input.Pin == "" || bcrypt.CompareHashAndPassword([]byte(*participant.PinHash), []byte(input.Pin)) != nil {
			s.logger.Warn().
				Str("event", "participant.pin_invalid").
				Str("appointmentId", input.AppointmentID).
				Str("requestId", requestID).
				Msg("PIN validation failed")
			return nil, application.NewInvalidPinError()
		}
	}

	availability, err := s.availability.ListByParticipant(ctx, participant.ID)
	if err != nil {
		s.logger.Error().
			Str("event", "participant.join_failed").
			Str("requestId", requestID).
			Str("participantId", participant.ID).
			Err(err).
			Msg("Failed to list participant availability")
		return nil, application.NewServiceUnavailableError()
	}

	responses := make([]string, 0, len(availability))
	for _, rec := range availability {
		responses = append(responses, rec.SlotKey)
	}

	s.logger.Info().
		Str("event", "participant.joined").
		Str("appointmentId", input.AppointmentID).
		Str("participantId", participant.ID).
		Str("nickname", participant.Nickname).
		Bool("hasPin", participant.PinHash != nil).
		Str("requestId", requestID).
		Msg("Participant joined")

	var submittedAt *string
	if participant.SubmittedAt != nil {
		v := participant.SubmittedAt.Format(rfc3339Milli)
		submittedAt = &v
	}

	return &JoinParticipantResult{
		ParticipantID: participant.ID,
		Nickname:      participant.Nickname,
		HasPin:        participant.PinHash != nil,
		SubmittedAt:   submittedAt,
		Responses:     responses,
	}, nil
}

// avoid unused-import lint when tests don't use errors yet.
var _ = errors.New

const rfc3339Milli = "2006-01-02T15:04:05.000Z07:00"
