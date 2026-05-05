// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package appointments

import (
	"context"
	"database/sql"
	"errors"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
)

type CreateAppointmentInput struct {
	Title              string
	Summary            string
	TimeSlotTemplateID string
}

type CreateAppointmentResult struct {
	AppointmentID      string
	ShareURL           string
	Title              string
	Summary            string
	TimeSlotTemplateID string
	CreatedAt          string // RFC3339Nano
}

type CreateAppointmentService struct {
	repo            repos.AppointmentRepository
	share           *domain.ShareURLBuilder
	activeTemplates *ActiveTemplateService
	metrics         metrics.AppointmentMetrics
	logger          zerolog.Logger
	db              *db.DB
}

func NewCreateAppointmentService(
	repo repos.AppointmentRepository,
	share *domain.ShareURLBuilder,
	active *ActiveTemplateService,
	m metrics.AppointmentMetrics,
	logger zerolog.Logger,
	database *db.DB,
) *CreateAppointmentService {
	return &CreateAppointmentService{
		repo:            repo,
		share:           share,
		activeTemplates: active,
		metrics:         m,
		logger:          logger,
		db:              database,
	}
}

func (s *CreateAppointmentService) Execute(ctx context.Context, input CreateAppointmentInput, requestID string) (CreateAppointmentResult, error) {
	if err := s.activeTemplates.EnsureTemplateIsActive(ctx, input.TimeSlotTemplateID); err != nil {
		return CreateAppointmentResult{}, err
	}

	var record repos.AppointmentRecord
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		rec, err := s.repo.Create(ctx, tx, repos.CreateAppointmentInput{
			Title:              input.Title,
			Summary:            input.Summary,
			TimeSlotTemplateID: input.TimeSlotTemplateID,
		})
		if err != nil {
			return err
		}
		record = rec
		return nil
	})
	if err != nil {
		s.logger.Error().
			Str("event", "appointment.create_failed").
			Str("requestId", requestID).
			Err(err).
			Msg("Failed to create appointment")
		var appErr *application.AppError
		if errors.As(err, &appErr) {
			return CreateAppointmentResult{}, appErr
		}
		return CreateAppointmentResult{}, application.NewServiceUnavailableError()
	}

	shareURL := s.share.BuildRelativePath(record.ID)
	titlePreview := record.Title
	if len(titlePreview) > 60 {
		titlePreview = titlePreview[:60]
	}
	summaryPreview := record.Summary
	if len(summaryPreview) > 200 {
		summaryPreview = summaryPreview[:200]
	}

	s.logger.Info().
		Str("event", "appointment.created").
		Str("appointmentId", record.ID).
		Str("requestId", requestID).
		Str("timeSlotTemplateId", record.TimeSlotTemplateID).
		Str("titlePreview", titlePreview).
		Str("summaryPreview", summaryPreview).
		Msg("Appointment created")

	s.metrics.IncrementAppointmentsCreated(record.TimeSlotTemplateID)

	return CreateAppointmentResult{
		AppointmentID:      record.ID,
		ShareURL:           shareURL,
		Title:              record.Title,
		Summary:            record.Summary,
		TimeSlotTemplateID: record.TimeSlotTemplateID,
		CreatedAt:          record.CreatedAt.Format(rfc3339Milli),
	}, nil
}

// rfc3339Milli mirrors the JS toISOString() output that the front-end and
// existing fixtures rely on.
const rfc3339Milli = "2006-01-02T15:04:05.000Z07:00"
