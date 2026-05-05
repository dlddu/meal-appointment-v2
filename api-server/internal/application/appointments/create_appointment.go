package appointments

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
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
	CreatedAt          time.Time
}

type CreateAppointmentContext struct {
	RequestID string
}

type CreateAppointmentService struct {
	repo                  repository.AppointmentRepository
	shareURL              *domain.ShareURLBuilder
	activeTemplateService *ActiveTemplateService
	metrics               metrics.AppointmentMetrics
	logger                *slog.Logger
	client                *db.Client
}

func NewCreateAppointmentService(
	repo repository.AppointmentRepository,
	shareURL *domain.ShareURLBuilder,
	activeTemplateService *ActiveTemplateService,
	m metrics.AppointmentMetrics,
	logger *slog.Logger,
	client *db.Client,
) *CreateAppointmentService {
	return &CreateAppointmentService{
		repo:                  repo,
		shareURL:              shareURL,
		activeTemplateService: activeTemplateService,
		metrics:               m,
		logger:                logger,
		client:                client,
	}
}

func (s *CreateAppointmentService) Execute(ctx context.Context, input CreateAppointmentInput, opCtx CreateAppointmentContext) (*CreateAppointmentResult, error) {
	if err := s.activeTemplateService.EnsureTemplateIsActive(ctx, input.TimeSlotTemplateID); err != nil {
		return nil, err
	}

	var record *repository.AppointmentRecord
	err := s.client.WithTx(ctx, func(tx db.Querier) error {
		var txErr error
		record, txErr = s.repo.Create(ctx, tx, repository.CreateAppointmentInput{
			Title:              input.Title,
			Summary:            input.Summary,
			TimeSlotTemplateID: input.TimeSlotTemplateID,
		})
		return txErr
	})
	if err != nil {
		var appErr *application.Error
		if errors.As(err, &appErr) {
			return nil, appErr
		}
		s.logger.Error("Failed to create appointment",
			slog.String("event", "appointment.create_failed"),
			slog.String("requestId", opCtx.RequestID),
			slog.Any("err", err))
		return nil, application.NewServiceUnavailable()
	}

	share := s.shareURL.BuildRelativePath(record.ID)
	s.logger.Info("Appointment created",
		slog.String("event", "appointment.created"),
		slog.String("appointmentId", record.ID),
		slog.String("requestId", opCtx.RequestID),
		slog.String("timeSlotTemplateId", record.TimeSlotTemplateID),
		slog.String("titlePreview", truncate(record.Title, 60)),
		slog.String("summaryPreview", truncate(record.Summary, 200)))
	s.metrics.IncrementAppointmentsCreated(record.TimeSlotTemplateID)

	return &CreateAppointmentResult{
		AppointmentID:      record.ID,
		ShareURL:           share,
		Title:              record.Title,
		Summary:            record.Summary,
		TimeSlotTemplateID: record.TimeSlotTemplateID,
		CreatedAt:          record.CreatedAt,
	}, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
