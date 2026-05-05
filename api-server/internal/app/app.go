// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package app

import (
	"net/http"
	"time"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/health"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/participants"
	templatesapp "github.com/dlddu/meal-appointment-v2/api-server/internal/application/templates"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/templates"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/presentation"
)

// Container holds all initialised application services.
type Container struct {
	Logger        zerolog.Logger
	DB            *db.DB
	Metrics       *metrics.Prometheus
	TemplateCache *templates.InMemoryCache
	Handler       http.Handler
}

// Build constructs every dependency, wires them together, and returns the
// resulting HTTP handler ready to be served.
func Build(database *db.DB, logger zerolog.Logger) *Container {
	m := metrics.NewPrometheus()
	templateCache := templates.NewInMemoryCache(5*time.Minute, m)

	appointmentRepo := repos.NewSQLiteAppointmentRepository(database)
	templateRepo := repos.NewSQLiteTemplateRepository(database)
	participantRepo := repos.NewSQLiteParticipantRepository(database)
	availabilityRepo := repos.NewSQLiteAvailabilityRepository(database)

	activeProvider := templates.NewDefaultActiveTemplateProvider()
	activeService := appointments.NewActiveTemplateService(activeProvider, 5*time.Minute)

	share := domain.NewShareURLBuilder()

	createAppointmentService := appointments.NewCreateAppointmentService(
		appointmentRepo, share, activeService, m, logger, database,
	)
	viewAppointmentService := appointments.NewViewAppointmentService(
		appointmentRepo, templateRepo, participantRepo, availabilityRepo, templateCache, m, logger,
	)
	joinService := participants.NewJoinParticipantService(
		appointmentRepo, participantRepo, availabilityRepo, m, logger, database,
	)
	templateService := participants.NewTimeSlotTemplateService(templateRepo, templateCache, logger)
	submitService := participants.NewSubmitResponsesService(
		appointmentRepo, participantRepo, availabilityRepo, templateService, m, logger, database,
	)
	listTemplatesService := templatesapp.NewListTemplatesService(templateRepo, activeService)

	healthService := health.NewService(database)

	handler := presentation.NewRouter(presentation.Dependencies{
		Logger:                   logger,
		Metrics:                  m,
		HealthService:            healthService,
		CreateAppointmentService: createAppointmentService,
		ViewAppointmentService:   viewAppointmentService,
		JoinParticipantService:   joinService,
		SubmitResponsesService:   submitService,
		ListTemplatesService:     listTemplatesService,
	})

	return &Container{
		Logger:        logger,
		DB:            database,
		Metrics:       m,
		TemplateCache: templateCache,
		Handler:       handler,
	}
}
