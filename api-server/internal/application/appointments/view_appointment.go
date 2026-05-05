// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

package appointments

import (
	"context"
	"errors"
	"math"
	"sort"
	"time"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/templates"
)

type ViewAppointmentError struct {
	Kind          string // "not_found", "template_unavailable", "template_evaluation", "service_unavailable"
	AppointmentID string
	TemplateID    string
}

func (e *ViewAppointmentError) Error() string {
	switch e.Kind {
	case "not_found":
		return "Appointment not found"
	case "template_unavailable":
		return "Template unavailable"
	case "template_evaluation":
		return "Template evaluation failed"
	default:
		return "Service temporarily unavailable"
	}
}

type ViewAppointmentResult struct {
	Appointment AppointmentDTO   `json:"appointment"`
	Template    TemplateDTO      `json:"template"`
	Participants []ParticipantDTO `json:"participants"`
	Aggregates  AggregatesDTO    `json:"aggregates"`
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
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description *string             `json:"description"`
	Rules       []repos.TemplateRule `json:"rules"`
}

type ParticipantDTO struct {
	ParticipantID string   `json:"participantId"`
	Nickname      string   `json:"nickname"`
	SubmittedAt   *string  `json:"submittedAt"`
	Responses     []string `json:"responses"`
}

type AggregatesDTO struct {
	ParticipantCount int                `json:"participantCount"`
	SlotSummaries    []SlotSummaryDTO   `json:"slotSummaries"`
}

type SlotSummaryDTO struct {
	SlotKey          string  `json:"slotKey"`
	Date             string  `json:"date"`
	MealType         string  `json:"mealType"`
	AvailableCount   int     `json:"availableCount"`
	AvailabilityRatio float64 `json:"availabilityRatio"`
}

type ViewAppointmentService struct {
	appointments repos.AppointmentRepository
	templates    repos.TemplateRepository
	participants repos.ParticipantRepository
	availability repos.AvailabilityRepository
	cache        templates.TemplateCache
	metrics      metrics.AppointmentMetrics
	logger       zerolog.Logger
}

func NewViewAppointmentService(
	appointments repos.AppointmentRepository,
	templateRepo repos.TemplateRepository,
	participants repos.ParticipantRepository,
	availability repos.AvailabilityRepository,
	cache templates.TemplateCache,
	m metrics.AppointmentMetrics,
	logger zerolog.Logger,
) *ViewAppointmentService {
	return &ViewAppointmentService{
		appointments: appointments,
		templates:    templateRepo,
		participants: participants,
		availability: availability,
		cache:        cache,
		metrics:      m,
		logger:       logger,
	}
}

func (s *ViewAppointmentService) Execute(ctx context.Context, appointmentID string, requestID string) (*ViewAppointmentResult, error) {
	start := time.Now()
	cacheHit := true

	defer func() {
		s.metrics.ObserveAppointmentViewDuration(float64(time.Since(start).Milliseconds()), cacheHit)
	}()

	appointment, err := s.loadAppointment(ctx, appointmentID, requestID)
	if err != nil {
		return nil, err
	}

	template, err := s.resolveTemplate(ctx, appointment, requestID, func(hit bool) { cacheHit = hit })
	if err != nil {
		return nil, err
	}

	participants, availability, err := s.loadParticipantsAndAvailability(ctx, appointment.ID, requestID)
	if err != nil {
		return nil, err
	}

	availabilityByParticipant := make(map[string][]string, len(availability))
	for _, rec := range availability {
		availabilityByParticipant[rec.ParticipantID] = append(availabilityByParticipant[rec.ParticipantID], rec.SlotKey)
	}

	selections := make([]domain.AvailabilitySelection, 0, len(availability))
	for _, rec := range availability {
		selections = append(selections, domain.AvailabilitySelection{ParticipantID: rec.ParticipantID, SlotKey: rec.SlotKey})
	}
	aggregation := domain.AvailabilityAggregator{}.Aggregate(selections)
	participantCount := len(participants)

	slotSummaries := make([]SlotSummaryDTO, 0, len(aggregation.AvailableCountBySlotKey))
	keys := make([]string, 0, len(aggregation.AvailableCountBySlotKey))
	for k := range aggregation.AvailableCountBySlotKey {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return domain.CompareSlotKeys(keys[i], keys[j]) < 0 })
	for _, slotKey := range keys {
		count := aggregation.AvailableCountBySlotKey[slotKey]
		date, mealType := domain.SplitSlotKey(slotKey)
		ratio := 0.0
		if participantCount > 0 {
			ratio = math.Round(float64(count)/float64(participantCount)*100) / 100
		}
		slotSummaries = append(slotSummaries, SlotSummaryDTO{
			SlotKey:           slotKey,
			Date:              date,
			MealType:          mealType,
			AvailableCount:    count,
			AvailabilityRatio: ratio,
		})
	}

	participantDTOs := make([]ParticipantDTO, 0, len(participants))
	for _, p := range participants {
		var submittedAt *string
		if p.SubmittedAt != nil {
			s := p.SubmittedAt.Format(rfc3339Milli)
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
			CreatedAt:          appointment.CreatedAt.Format(rfc3339Milli),
			UpdatedAt:          appointment.UpdatedAt.Format(rfc3339Milli),
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

	s.logger.Info().
		Str("event", "appointment.viewed").
		Str("appointmentId", appointment.ID).
		Int("participantCount", participantCount).
		Int("slotCount", len(slotSummaries)).
		Int64("durationMs", time.Since(start).Milliseconds()).
		Str("requestId", requestID).
		Msg("Appointment viewed")

	return result, nil
}

func (s *ViewAppointmentService) loadAppointment(ctx context.Context, appointmentID, requestID string) (*repos.AppointmentRecord, error) {
	rec, err := s.appointments.FindByID(ctx, appointmentID)
	if err != nil {
		s.logger.Error().
			Str("event", "appointment.view_failed").
			Str("requestId", requestID).
			Str("stage", "fetch-appointment").
			Str("appointmentId", appointmentID).
			Err(err).
			Msg("Failed to load appointment")
		return nil, &ViewAppointmentError{Kind: "service_unavailable", AppointmentID: appointmentID}
	}
	if rec == nil {
		return nil, &ViewAppointmentError{Kind: "not_found", AppointmentID: appointmentID}
	}
	return rec, nil
}

func (s *ViewAppointmentService) resolveTemplate(ctx context.Context, appointment *repos.AppointmentRecord, requestID string, onCacheEvaluation func(hit bool)) (*repos.TemplateRecord, error) {
	templateID := appointment.TimeSlotTemplateID
	if cached := s.cache.Get(templateID); cached != nil {
		onCacheEvaluation(true)
		return cached, nil
	}
	onCacheEvaluation(false)
	s.logger.Debug().
		Str("event", "template.cache.miss").
		Str("requestId", requestID).
		Str("templateId", templateID).
		Str("appointmentId", appointment.ID).
		Msg("Template cache miss")

	tmpl, err := s.templates.FindByID(ctx, templateID)
	if err != nil {
		s.logger.Error().
			Str("event", "appointment.view_failed").
			Str("requestId", requestID).
			Str("stage", "load-template").
			Str("appointmentId", appointment.ID).
			Err(err).
			Msg("Failed to load template")
		var parsing repos.TemplateParsingError
		if errors.As(err, &parsing) {
			return nil, &ViewAppointmentError{Kind: "template_evaluation", AppointmentID: appointment.ID, TemplateID: templateID}
		}
		return nil, &ViewAppointmentError{Kind: "service_unavailable", AppointmentID: appointment.ID, TemplateID: templateID}
	}
	if tmpl == nil {
		return nil, &ViewAppointmentError{Kind: "template_unavailable", AppointmentID: appointment.ID, TemplateID: templateID}
	}
	s.cache.Set(templateID, *tmpl)
	return tmpl, nil
}

func (s *ViewAppointmentService) loadParticipantsAndAvailability(ctx context.Context, appointmentID, requestID string) ([]repos.ParticipantRecord, []repos.AvailabilityRecord, error) {
	participants, err := s.participants.ListByAppointment(ctx, appointmentID)
	if err != nil {
		s.logger.Error().
			Str("event", "appointment.view_failed").
			Str("requestId", requestID).
			Str("stage", "aggregate-availability").
			Str("appointmentId", appointmentID).
			Err(err).
			Msg("Failed to load participants")
		return nil, nil, &ViewAppointmentError{Kind: "service_unavailable", AppointmentID: appointmentID}
	}
	availability, err := s.availability.ListAvailability(ctx, appointmentID)
	if err != nil {
		s.logger.Error().
			Str("event", "appointment.view_failed").
			Str("requestId", requestID).
			Str("stage", "aggregate-availability").
			Str("appointmentId", appointmentID).
			Err(err).
			Msg("Failed to load availability")
		return nil, nil, &ViewAppointmentError{Kind: "service_unavailable", AppointmentID: appointmentID}
	}
	return participants, availability, nil
}
