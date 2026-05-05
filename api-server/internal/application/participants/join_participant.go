package participants

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
)

type JoinParticipantInput struct {
	AppointmentID string
	Nickname      string
	Pin           string
}

type JoinParticipantContext struct {
	RequestID string
}

type JoinParticipantResult struct {
	ParticipantID string   `json:"participantId"`
	Nickname      string   `json:"nickname"`
	HasPin        bool     `json:"hasPin"`
	SubmittedAt   *string  `json:"submittedAt"`
	Responses     []string `json:"responses"`
}

type JoinParticipantService struct {
	appointmentRepo  repository.AppointmentRepository
	participantRepo  repository.ParticipantRepository
	availabilityRepo repository.AvailabilityRepository
	metrics          metrics.AppointmentMetrics
	log              *slog.Logger
	client           *db.Client
}

func NewJoinParticipantService(
	appointmentRepo repository.AppointmentRepository,
	participantRepo repository.ParticipantRepository,
	availabilityRepo repository.AvailabilityRepository,
	m metrics.AppointmentMetrics,
	log *slog.Logger,
	client *db.Client,
) *JoinParticipantService {
	return &JoinParticipantService{
		appointmentRepo:  appointmentRepo,
		participantRepo:  participantRepo,
		availabilityRepo: availabilityRepo,
		metrics:          m,
		log:              log,
		client:           client,
	}
}

func (s *JoinParticipantService) Execute(ctx context.Context, input JoinParticipantInput, opCtx JoinParticipantContext) (*JoinParticipantResult, error) {
	start := time.Now()
	defer func() {
		s.metrics.ObserveParticipantJoin(float64(time.Since(start).Milliseconds()))
	}()

	appointment, err := s.appointmentRepo.FindByID(ctx, input.AppointmentID)
	if err != nil {
		s.log.Error("Failed to load appointment",
			slog.String("event", "participant.join_failed"),
			slog.String("requestId", opCtx.RequestID),
			slog.String("appointmentId", input.AppointmentID),
			slog.Any("err", err))
		return nil, application.NewServiceUnavailable()
	}
	if appointment == nil {
		return nil, application.NewAppointmentNotFound()
	}

	participant, err := s.participantRepo.FindByAppointmentAndNickname(ctx, input.AppointmentID, input.Nickname)
	if err != nil {
		s.log.Error("Failed to lookup participant",
			slog.String("event", "participant.join_failed"),
			slog.String("requestId", opCtx.RequestID),
			slog.String("appointmentId", input.AppointmentID),
			slog.Any("err", err))
		return nil, application.NewServiceUnavailable()
	}

	if participant == nil {
		var pinHash *string
		if input.Pin != "" {
			hashed, hashErr := bcrypt.GenerateFromPassword([]byte(input.Pin), 10)
			if hashErr != nil {
				return nil, application.NewServiceUnavailable()
			}
			h := string(hashed)
			pinHash = &h
		}
		txErr := s.client.WithTx(ctx, func(tx db.Querier) error {
			created, createErr := s.participantRepo.Create(ctx, tx, input.AppointmentID, input.Nickname, pinHash)
			if createErr != nil {
				return createErr
			}
			participant = created
			return nil
		})
		if txErr != nil {
			if db.IsUniqueViolation(txErr) {
				return nil, application.NewNicknameTaken()
			}
			s.log.Error("Failed to create participant",
				slog.String("event", "participant.join_failed"),
				slog.String("requestId", opCtx.RequestID),
				slog.String("appointmentId", input.AppointmentID),
				slog.Any("err", txErr))
			return nil, application.NewServiceUnavailable()
		}
	} else if participant.PinHash != nil {
		if input.Pin == "" {
			s.log.Warn("PIN validation failed",
				slog.String("event", "participant.pin_invalid"),
				slog.String("appointmentId", input.AppointmentID),
				slog.String("requestId", opCtx.RequestID))
			return nil, application.NewInvalidPin()
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*participant.PinHash), []byte(input.Pin)); err != nil {
			if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
				s.log.Warn("PIN validation failed",
					slog.String("event", "participant.pin_invalid"),
					slog.String("appointmentId", input.AppointmentID),
					slog.String("requestId", opCtx.RequestID))
				return nil, application.NewInvalidPin()
			}
			return nil, application.NewServiceUnavailable()
		}
	}

	availability, err := s.availabilityRepo.ListByParticipant(ctx, participant.ID)
	if err != nil {
		s.log.Error("Failed to load availability",
			slog.String("event", "participant.join_failed"),
			slog.String("requestId", opCtx.RequestID),
			slog.String("participantId", participant.ID),
			slog.Any("err", err))
		return nil, application.NewServiceUnavailable()
	}
	responses := make([]string, 0, len(availability))
	for _, r := range availability {
		responses = append(responses, r.SlotKey)
	}

	s.log.Info("Participant joined",
		slog.String("event", "participant.joined"),
		slog.String("appointmentId", input.AppointmentID),
		slog.String("participantId", participant.ID),
		slog.String("nickname", participant.Nickname),
		slog.Bool("hasPin", participant.PinHash != nil),
		slog.String("requestId", opCtx.RequestID))

	var submittedAt *string
	if participant.SubmittedAt != nil {
		s := participant.SubmittedAt.UTC().Format(time.RFC3339Nano)
		submittedAt = &s
	}
	return &JoinParticipantResult{
		ParticipantID: participant.ID,
		Nickname:      participant.Nickname,
		HasPin:        participant.PinHash != nil,
		SubmittedAt:   submittedAt,
		Responses:     responses,
	}, nil
}
