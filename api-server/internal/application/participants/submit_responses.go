// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package participants

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"sort"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
)

type SubmitResponsesInput struct {
	AppointmentID  string
	ParticipantID  string
	Nickname       string
	Pin            string
	AvailableSlots []string
}

type SubmitResponsesResult struct {
	ParticipantID string         `json:"participantId"`
	SubmittedAt   string         `json:"submittedAt"`
	Selected      []string       `json:"selected"`
	Summary       ResponseSummary `json:"summary"`
}

type ResponseSummary struct {
	ParticipantCount int                  `json:"participantCount"`
	SlotSummaries    []ResponseSlotSummary `json:"slotSummaries"`
}

type ResponseSlotSummary struct {
	SlotKey           string  `json:"slotKey"`
	Date              string  `json:"date"`
	MealType          string  `json:"mealType"`
	AvailableCount    int     `json:"availableCount"`
	AvailabilityRatio float64 `json:"availabilityRatio"`
}

type SubmitResponsesService struct {
	appointments    repos.AppointmentRepository
	participants    repos.ParticipantRepository
	availability    repos.AvailabilityRepository
	templateService *TimeSlotTemplateService
	metrics         metrics.AppointmentMetrics
	logger          zerolog.Logger
	db              *db.DB
}

func NewSubmitResponsesService(
	appointments repos.AppointmentRepository,
	participants repos.ParticipantRepository,
	availability repos.AvailabilityRepository,
	templateService *TimeSlotTemplateService,
	m metrics.AppointmentMetrics,
	logger zerolog.Logger,
	database *db.DB,
) *SubmitResponsesService {
	return &SubmitResponsesService{
		appointments:    appointments,
		participants:    participants,
		availability:    availability,
		templateService: templateService,
		metrics:         m,
		logger:          logger,
		db:              database,
	}
}

func (s *SubmitResponsesService) Execute(ctx context.Context, input SubmitResponsesInput, requestID string) (*SubmitResponsesResult, error) {
	start := time.Now()
	defer func() {
		s.metrics.ObserveResponseSubmission(float64(time.Since(start).Milliseconds()), len(input.AvailableSlots))
	}()

	appointment, err := s.appointments.FindByID(ctx, input.AppointmentID)
	if err != nil {
		s.logger.Error().
			Str("event", "participant.responses.failed").
			Str("appointmentId", input.AppointmentID).
			Str("participantId", input.ParticipantID).
			Str("requestId", requestID).
			Err(err).
			Msg("Failed to load appointment")
		return nil, application.NewServiceUnavailableError()
	}
	if appointment == nil {
		return nil, application.NewAppointmentNotFoundError()
	}

	participant, err := s.participants.FindByID(ctx, input.ParticipantID)
	if err != nil {
		s.logger.Error().
			Str("event", "participant.responses.failed").
			Str("appointmentId", input.AppointmentID).
			Str("participantId", input.ParticipantID).
			Str("requestId", requestID).
			Err(err).
			Msg("Failed to load participant")
		return nil, application.NewServiceUnavailableError()
	}
	if participant == nil || participant.AppointmentID != appointment.ID || participant.Nickname != input.Nickname {
		return nil, application.NewParticipantMismatchError()
	}

	if participant.PinHash != nil {
		if input.Pin == "" || bcrypt.CompareHashAndPassword([]byte(*participant.PinHash), []byte(input.Pin)) != nil {
			s.logger.Warn().
				Str("event", "participant.pin_invalid").
				Str("appointmentId", input.AppointmentID).
				Str("participantId", input.ParticipantID).
				Str("requestId", requestID).
				Msg("PIN validation failed")
			return nil, application.NewInvalidPinError()
		}
	}

	dedupedSlots := dedupePreserveOrder(input.AvailableSlots)
	validator, err := s.templateService.BuildValidator(ctx, appointment.TimeSlotTemplateID, requestID)
	if err != nil {
		var appErr *application.AppError
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		return nil, application.NewServiceUnavailableError()
	}
	invalidSlots := make([]string, 0)
	for _, slot := range dedupedSlots {
		if !validator.IsValid(slot) {
			invalidSlots = append(invalidSlots, slot)
		}
	}
	if len(invalidSlots) > 0 {
		s.logger.Warn().
			Str("event", "participant.slot_invalid").
			Str("appointmentId", input.AppointmentID).
			Str("participantId", input.ParticipantID).
			Strs("invalidSlots", invalidSlots).
			Str("requestId", requestID).
			Msg("Slot validation failed")
		return nil, application.NewInvalidSlotError(invalidSlots)
	}

	submittedAt := time.Now().UTC()
	err = s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if err := s.availability.ReplaceForParticipant(ctx, tx, appointment.ID, participant.ID, dedupedSlots, submittedAt); err != nil {
			return err
		}
		return s.participants.UpdateSubmittedAt(ctx, tx, participant.ID, submittedAt)
	})
	if err != nil {
		s.logger.Error().
			Str("event", "participant.responses.failed").
			Str("appointmentId", input.AppointmentID).
			Str("participantId", input.ParticipantID).
			Str("requestId", requestID).
			Err(err).
			Msg("Failed to persist responses")
		return nil, application.NewServiceUnavailableError()
	}

	participantsList, err := s.participants.ListByAppointment(ctx, appointment.ID)
	if err != nil {
		return nil, application.NewServiceUnavailableError()
	}
	availabilityList, err := s.availability.ListAvailability(ctx, appointment.ID)
	if err != nil {
		return nil, application.NewServiceUnavailableError()
	}

	selections := make([]domain.AvailabilitySelection, 0, len(availabilityList))
	for _, rec := range availabilityList {
		selections = append(selections, domain.AvailabilitySelection{ParticipantID: rec.ParticipantID, SlotKey: rec.SlotKey})
	}
	aggregation := domain.AvailabilityAggregator{}.Aggregate(selections)
	participantCount := len(participantsList)

	keys := make([]string, 0, len(aggregation.AvailableCountBySlotKey))
	for k := range aggregation.AvailableCountBySlotKey {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return domain.CompareSlotKeys(keys[i], keys[j]) < 0 })

	slotSummaries := make([]ResponseSlotSummary, 0, len(keys))
	for _, slotKey := range keys {
		count := aggregation.AvailableCountBySlotKey[slotKey]
		date, mealType := domain.SplitSlotKey(slotKey)
		ratio := 0.0
		if participantCount > 0 {
			ratio = math.Round(float64(count)/float64(participantCount)*100) / 100
		}
		slotSummaries = append(slotSummaries, ResponseSlotSummary{
			SlotKey:           slotKey,
			Date:              date,
			MealType:          mealType,
			AvailableCount:    count,
			AvailabilityRatio: ratio,
		})
	}

	s.logger.Info().
		Str("event", "participant.responses.submitted").
		Str("appointmentId", appointment.ID).
		Str("participantId", participant.ID).
		Int("slotCount", len(dedupedSlots)).
		Int64("durationMs", time.Since(start).Milliseconds()).
		Str("requestId", requestID).
		Msg("Participant responses submitted")

	return &SubmitResponsesResult{
		ParticipantID: participant.ID,
		SubmittedAt:   submittedAt.Format(rfc3339Milli),
		Selected:      dedupedSlots,
		Summary: ResponseSummary{
			ParticipantCount: participantCount,
			SlotSummaries:    slotSummaries,
		},
	}, nil
}

func dedupePreserveOrder(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, v := range values {
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}
