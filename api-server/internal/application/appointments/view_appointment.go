package appointments

import (
	"context"
	"errors"
	"log/slog"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
)

var (
	ErrAppointmentNotFound = errors.New("appointment not found")
	ErrTemplateUnavailable = errors.New("template unavailable")
	ErrTemplateEvaluation  = errors.New("template evaluation failed")
	ErrServiceUnavailable  = errors.New("service temporarily unavailable")
)

type ViewAppointmentResult struct {
	Appointment  AppointmentDTO   `json:"appointment"`
	Template     TemplateDTO      `json:"template"`
	Participants []ParticipantDTO `json:"participants"`
	Aggregates   AggregatesDTO    `json:"aggregates"`
}

type AppointmentDTO struct {
	ID                 string `json:"id"`
	Title              string `json:"title"`
	Summary            string `json:"summary"`
	CreatedAt          string `json:"createdAt"`
	UpdatedAt          string `json:"updatedAt"`
	TimeSlotTemplateID string `json:"timeSlotTemplateId"`
}

type TemplateDTO struct {
	ID          string                  `json:"id"`
	Name        string                  `json:"name"`
	Description *string                 `json:"description"`
	Rules       []repository.TemplateRule `json:"rules"`
}

type ParticipantDTO struct {
	ParticipantID string   `json:"participantId"`
	Nickname      string   `json:"nickname"`
	SubmittedAt   *string  `json:"submittedAt"`
	Responses     []string `json:"responses"`
}

type AggregatesDTO struct {
	ParticipantCount int                 `json:"participantCount"`
	SlotSummaries    []SlotSummaryDTO    `json:"slotSummaries"`
}

type SlotSummaryDTO struct {
	SlotKey           string  `json:"slotKey"`
	Date              string  `json:"date"`
	MealType          string  `json:"mealType"`
	AvailableCount    int     `json:"availableCount"`
	AvailabilityRatio float64 `json:"availabilityRatio"`
}

type ViewAppointmentService struct {
	appointmentRepo  repository.AppointmentRepository
	templateRepo     repository.TemplateRepository
	participantRepo  repository.ParticipantRepository
	availabilityRepo repository.AvailabilityRepository
	templateCache    repository.TemplateCache
	metrics          metrics.AppointmentMetrics
	logger           *slog.Logger
	aggregator       *domain.AvailabilityAggregator
}

func NewViewAppointmentService(
	appointmentRepo repository.AppointmentRepository,
	templateRepo repository.TemplateRepository,
	participantRepo repository.ParticipantRepository,
	availabilityRepo repository.AvailabilityRepository,
	templateCache repository.TemplateCache,
	m metrics.AppointmentMetrics,
	logger *slog.Logger,
) *ViewAppointmentService {
	return &ViewAppointmentService{
		appointmentRepo:  appointmentRepo,
		templateRepo:     templateRepo,
		participantRepo:  participantRepo,
		availabilityRepo: availabilityRepo,
		templateCache:    templateCache,
		metrics:          m,
		logger:           logger,
		aggregator:       domain.NewAvailabilityAggregator(),
	}
}

type ViewAppointmentContext struct {
	RequestID string
}

func (s *ViewAppointmentService) Execute(ctx context.Context, appointmentID string, opCtx ViewAppointmentContext) (*ViewAppointmentResult, error) {
	start := time.Now()
	cacheHit := true

	defer func() {
		s.metrics.ObserveAppointmentViewDuration(float64(time.Since(start).Milliseconds()), cacheHit)
	}()

	appointment, err := s.loadAppointment(ctx, appointmentID, opCtx)
	if err != nil {
		return nil, err
	}

	template, hit, err := s.resolveTemplate(ctx, appointment, opCtx)
	cacheHit = hit
	if err != nil {
		return nil, err
	}

	participants, availability, err := s.loadParticipantsAndAvailability(ctx, appointment.ID, opCtx)
	if err != nil {
		return nil, err
	}

	availabilityByParticipant := make(map[string][]string)
	selections := make([]domain.AvailabilitySelection, 0, len(availability))
	for _, record := range availability {
		availabilityByParticipant[record.ParticipantID] = append(availabilityByParticipant[record.ParticipantID], record.SlotKey)
		selections = append(selections, domain.AvailabilitySelection{ParticipantID: record.ParticipantID, SlotKey: record.SlotKey})
	}

	aggregation := s.aggregator.Aggregate(selections)
	participantCount := len(participants)

	slotSummaries := buildSlotSummaries(aggregation.AvailableCountBySlotKey, participantCount)

	participantDTOs := make([]ParticipantDTO, 0, len(participants))
	for _, p := range participants {
		var submittedAt *string
		if p.SubmittedAt != nil {
			s := p.SubmittedAt.UTC().Format(time.RFC3339Nano)
			submittedAt = &s
		}
		responses := availabilityByParticipant[p.ID]
		if responses == nil {
			responses = []string{}
		}
		participantDTOs = append(participantDTOs, ParticipantDTO{
			ParticipantID: p.ID,
			Nickname:      p.Nickname,
			SubmittedAt:   submittedAt,
			Responses:     responses,
		})
	}

	result := &ViewAppointmentResult{
		Appointment: AppointmentDTO{
			ID:                 appointment.ID,
			Title:              appointment.Title,
			Summary:            appointment.Summary,
			CreatedAt:          appointment.CreatedAt.UTC().Format(time.RFC3339Nano),
			UpdatedAt:          appointment.UpdatedAt.UTC().Format(time.RFC3339Nano),
			TimeSlotTemplateID: appointment.TimeSlotTemplateID,
		},
		Template: TemplateDTO{
			ID:          template.ID,
			Name:        template.Name,
			Description: template.Description,
			Rules:       template.Rules,
		},
		Participants: participantDTOs,
		Aggregates: AggregatesDTO{
			ParticipantCount: participantCount,
			SlotSummaries:    slotSummaries,
		},
	}

	s.logger.Info("Appointment viewed",
		slog.String("event", "appointment.viewed"),
		slog.String("appointmentId", appointment.ID),
		slog.Int("participantCount", participantCount),
		slog.Int("slotCount", len(slotSummaries)),
		slog.Int64("durationMs", time.Since(start).Milliseconds()),
		slog.String("requestId", opCtx.RequestID))

	return result, nil
}

func (s *ViewAppointmentService) loadAppointment(ctx context.Context, appointmentID string, opCtx ViewAppointmentContext) (*repository.AppointmentRecord, error) {
	appointment, err := s.appointmentRepo.FindByID(ctx, appointmentID)
	if err != nil {
		s.logger.Error("Failed to load appointment",
			slog.String("event", "appointment.view_failed"),
			slog.String("requestId", opCtx.RequestID),
			slog.String("appointmentId", appointmentID),
			slog.String("stage", "fetch-appointment"),
			slog.Any("err", err))
		return nil, ErrServiceUnavailable
	}
	if appointment == nil {
		return nil, ErrAppointmentNotFound
	}
	return appointment, nil
}

func (s *ViewAppointmentService) resolveTemplate(ctx context.Context, appointment *repository.AppointmentRecord, opCtx ViewAppointmentContext) (*repository.TemplateRecord, bool, error) {
	templateID := appointment.TimeSlotTemplateID
	if cached := s.templateCache.Get(templateID); cached != nil {
		return cached, true, nil
	}
	s.logger.Debug("Template cache miss",
		slog.String("event", "template.cache.miss"),
		slog.String("requestId", opCtx.RequestID),
		slog.String("templateId", templateID),
		slog.String("appointmentId", appointment.ID))

	template, err := s.templateRepo.FindByID(ctx, templateID)
	if err != nil {
		s.logger.Error("Failed to load template",
			slog.String("event", "appointment.view_failed"),
			slog.String("requestId", opCtx.RequestID),
			slog.String("appointmentId", appointment.ID),
			slog.String("stage", "load-template"),
			slog.Any("err", err))
		if errors.Is(err, repository.ErrTemplateParsing) {
			return nil, false, ErrTemplateEvaluation
		}
		return nil, false, ErrServiceUnavailable
	}
	if template == nil {
		return nil, false, ErrTemplateUnavailable
	}
	s.templateCache.Set(templateID, *template)
	return template, false, nil
}

func (s *ViewAppointmentService) loadParticipantsAndAvailability(ctx context.Context, appointmentID string, opCtx ViewAppointmentContext) ([]repository.ParticipantRecord, []repository.AvailabilityRecord, error) {
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
		participants, pErr = s.participantRepo.ListByAppointment(ctx, appointmentID)
	}()
	go func() {
		defer wg.Done()
		availability, aErr = s.availabilityRepo.ListAvailability(ctx, appointmentID)
	}()
	wg.Wait()

	if pErr != nil || aErr != nil {
		err := pErr
		if err == nil {
			err = aErr
		}
		s.logger.Error("Failed to load availability",
			slog.String("event", "appointment.view_failed"),
			slog.String("requestId", opCtx.RequestID),
			slog.String("appointmentId", appointmentID),
			slog.String("stage", "aggregate-availability"),
			slog.Any("err", err))
		return nil, nil, ErrServiceUnavailable
	}
	return participants, availability, nil
}

func buildSlotSummaries(counts map[string]int, participantCount int) []SlotSummaryDTO {
	keys := make([]string, 0, len(counts))
	for k := range counts {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		return domain.CompareSlotKeys(keys[i], keys[j]) < 0
	})
	summaries := make([]SlotSummaryDTO, 0, len(keys))
	for _, key := range keys {
		date, mealType := domain.SplitSlotKey(key)
		count := counts[key]
		ratio := 0.0
		if participantCount > 0 {
			ratio = math.Round(float64(count)/float64(participantCount)*100) / 100
		}
		summaries = append(summaries, SlotSummaryDTO{
			SlotKey:           key,
			Date:              date,
			MealType:          mealType,
			AvailableCount:    count,
			AvailabilityRatio: ratio,
		})
	}
	return summaries
}
