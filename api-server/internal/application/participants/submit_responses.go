package participants

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"sort"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
)

type SubmitResponsesInput struct {
	AppointmentID  string
	ParticipantID  string
	Nickname       string
	Pin            string
	AvailableSlots []string
}

type SubmitResponsesContext struct {
	RequestID string
}

type SubmitResponsesResult struct {
	ParticipantID string                  `json:"participantId"`
	SubmittedAt   string                  `json:"submittedAt"`
	Selected      []string                `json:"selected"`
	Summary       SubmitResponsesSummary  `json:"summary"`
}

type SubmitResponsesSummary struct {
	ParticipantCount int                     `json:"participantCount"`
	SlotSummaries    []SubmitSlotSummary     `json:"slotSummaries"`
}

type SubmitSlotSummary struct {
	SlotKey           string  `json:"slotKey"`
	Date              string  `json:"date"`
	MealType          string  `json:"mealType"`
	AvailableCount    int     `json:"availableCount"`
	AvailabilityRatio float64 `json:"availabilityRatio"`
}

type SubmitResponsesService struct {
	appointmentRepo  repository.AppointmentRepository
	participantRepo  repository.ParticipantRepository
	availabilityRepo repository.AvailabilityRepository
	templateService  *TimeSlotTemplateService
	metrics          metrics.AppointmentMetrics
	log              *slog.Logger
	client           *db.Client
	aggregator       *domain.AvailabilityAggregator
}

func NewSubmitResponsesService(
	appointmentRepo repository.AppointmentRepository,
	participantRepo repository.ParticipantRepository,
	availabilityRepo repository.AvailabilityRepository,
	templateService *TimeSlotTemplateService,
	m metrics.AppointmentMetrics,
	log *slog.Logger,
	client *db.Client,
) *SubmitResponsesService {
	return &SubmitResponsesService{
		appointmentRepo:  appointmentRepo,
		participantRepo:  participantRepo,
		availabilityRepo: availabilityRepo,
		templateService:  templateService,
		metrics:          m,
		log:              log,
		client:           client,
		aggregator:       domain.NewAvailabilityAggregator(),
	}
}

func (s *SubmitResponsesService) Execute(ctx context.Context, input SubmitResponsesInput, opCtx SubmitResponsesContext) (*SubmitResponsesResult, error) {
	start := time.Now()
	defer func() {
		s.metrics.ObserveResponseSubmission(float64(time.Since(start).Milliseconds()), len(input.AvailableSlots))
	}()

	appointment, err := s.appointmentRepo.FindByID(ctx, input.AppointmentID)
	if err != nil {
		return nil, s.failedServiceUnavailable(opCtx, input, "load-appointment", err)
	}
	if appointment == nil {
		return nil, application.NewAppointmentNotFound()
	}

	participant, err := s.participantRepo.FindByID(ctx, input.ParticipantID)
	if err != nil {
		return nil, s.failedServiceUnavailable(opCtx, input, "load-participant", err)
	}
	if participant == nil || participant.AppointmentID != appointment.ID || participant.Nickname != input.Nickname {
		return nil, application.NewParticipantMismatch()
	}

	if participant.PinHash != nil {
		if input.Pin == "" {
			s.logPinFailure(opCtx, input)
			return nil, application.NewInvalidPin()
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*participant.PinHash), []byte(input.Pin)); err != nil {
			if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
				s.logPinFailure(opCtx, input)
				return nil, application.NewInvalidPin()
			}
			return nil, application.NewServiceUnavailable()
		}
	}

	dedupedSlots := dedupe(input.AvailableSlots)
	validator, err := s.templateService.BuildValidator(ctx, appointment.TimeSlotTemplateID, TemplateValidationContext{RequestID: opCtx.RequestID})
	if err != nil {
		return nil, err
	}

	invalid := make([]string, 0)
	for _, slot := range dedupedSlots {
		if !validator.IsValid(slot) {
			invalid = append(invalid, slot)
		}
	}
	if len(invalid) > 0 {
		s.log.Warn("Slot validation failed",
			slog.String("event", "participant.slot_invalid"),
			slog.String("appointmentId", input.AppointmentID),
			slog.String("participantId", input.ParticipantID),
			slog.Any("invalidSlots", invalid),
			slog.String("requestId", opCtx.RequestID))
		return nil, application.NewInvalidSlots(invalid)
	}

	submittedAt := time.Now().UTC()
	if err := s.client.WithTx(ctx, func(tx db.Querier) error {
		if err := s.availabilityRepo.ReplaceForParticipant(ctx, tx, appointment.ID, participant.ID, dedupedSlots, submittedAt); err != nil {
			return err
		}
		return s.participantRepo.UpdateSubmittedAt(ctx, tx, participant.ID, submittedAt)
	}); err != nil {
		return nil, s.failedServiceUnavailable(opCtx, input, "persist", err)
	}

	var (
		participants []repository.ParticipantRecord
		availability []repository.AvailabilityRecord
		pErr         error
		aErr         error
		wg           sync.WaitGroup
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		participants, pErr = s.participantRepo.ListByAppointment(ctx, appointment.ID)
	}()
	go func() {
		defer wg.Done()
		availability, aErr = s.availabilityRepo.ListAvailability(ctx, appointment.ID)
	}()
	wg.Wait()

	if pErr != nil || aErr != nil {
		err := pErr
		if err == nil {
			err = aErr
		}
		return nil, s.failedServiceUnavailable(opCtx, input, "aggregate", err)
	}

	selections := make([]domain.AvailabilitySelection, 0, len(availability))
	for _, r := range availability {
		selections = append(selections, domain.AvailabilitySelection{ParticipantID: r.ParticipantID, SlotKey: r.SlotKey})
	}
	aggregation := s.aggregator.Aggregate(selections)
	participantCount := len(participants)
	slotSummaries := buildSubmitSlotSummaries(aggregation.AvailableCountBySlotKey, participantCount)

	s.log.Info("Participant responses submitted",
		slog.String("event", "participant.responses.submitted"),
		slog.String("appointmentId", appointment.ID),
		slog.String("participantId", participant.ID),
		slog.Int("slotCount", len(dedupedSlots)),
		slog.Int64("durationMs", time.Since(start).Milliseconds()),
		slog.String("requestId", opCtx.RequestID))

	return &SubmitResponsesResult{
		ParticipantID: participant.ID,
		SubmittedAt:   submittedAt.Format(time.RFC3339Nano),
		Selected:      dedupedSlots,
		Summary: SubmitResponsesSummary{
			ParticipantCount: participantCount,
			SlotSummaries:    slotSummaries,
		},
	}, nil
}

func (s *SubmitResponsesService) failedServiceUnavailable(opCtx SubmitResponsesContext, input SubmitResponsesInput, stage string, err error) error {
	s.log.Error("Failed to submit responses",
		slog.String("event", "participant.responses.failed"),
		slog.String("appointmentId", input.AppointmentID),
		slog.String("participantId", input.ParticipantID),
		slog.String("stage", stage),
		slog.String("requestId", opCtx.RequestID),
		slog.Any("err", err))
	return application.NewServiceUnavailable()
}

func (s *SubmitResponsesService) logPinFailure(opCtx SubmitResponsesContext, input SubmitResponsesInput) {
	s.log.Warn("PIN validation failed",
		slog.String("event", "participant.pin_invalid"),
		slog.String("appointmentId", input.AppointmentID),
		slog.String("participantId", input.ParticipantID),
		slog.String("requestId", opCtx.RequestID))
}

func dedupe(slots []string) []string {
	seen := make(map[string]struct{}, len(slots))
	result := make([]string, 0, len(slots))
	for _, slot := range slots {
		if _, ok := seen[slot]; ok {
			continue
		}
		seen[slot] = struct{}{}
		result = append(result, slot)
	}
	return result
}

func buildSubmitSlotSummaries(counts map[string]int, participantCount int) []SubmitSlotSummary {
	keys := make([]string, 0, len(counts))
	for k := range counts {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		return domain.CompareSlotKeys(keys[i], keys[j]) < 0
	})
	summaries := make([]SubmitSlotSummary, 0, len(keys))
	for _, key := range keys {
		date, mealType := domain.SplitSlotKey(key)
		count := counts[key]
		ratio := 0.0
		if participantCount > 0 {
			ratio = math.Round(float64(count)/float64(participantCount)*100) / 100
		}
		summaries = append(summaries, SubmitSlotSummary{
			SlotKey:           key,
			Date:              date,
			MealType:          mealType,
			AvailableCount:    count,
			AvailabilityRatio: ratio,
		})
	}
	return summaries
}
