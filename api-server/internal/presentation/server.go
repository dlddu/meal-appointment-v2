// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package presentation

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/health"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/participants"
	templatesapp "github.com/dlddu/meal-appointment-v2/api-server/internal/application/templates"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
)

type Dependencies struct {
	Logger                  zerolog.Logger
	Metrics                 metrics.AppointmentMetrics
	HealthService           *health.Service
	CreateAppointmentService *appointments.CreateAppointmentService
	ViewAppointmentService  *appointments.ViewAppointmentService
	JoinParticipantService  *participants.JoinParticipantService
	SubmitResponsesService  *participants.SubmitResponsesService
	ListTemplatesService    *templatesapp.ListTemplatesService
}

// NewRouter wires up all handlers and middleware. The returned http.Handler is
// safe to attach to an http.Server.
func NewRouter(deps Dependencies) http.Handler {
	r := chi.NewRouter()
	r.Use(CORSMiddleware)
	r.Use(RequestIDMiddleware)

	r.Route("/api", func(api chi.Router) {
		api.Get("/health", newHealthHandler(deps.HealthService))

		api.Route("/appointments", func(ar chi.Router) {
			ar.Post("/", newCreateAppointmentHandler(deps.CreateAppointmentService, deps.Logger))
			ar.Get("/{appointmentId}", newViewAppointmentHandler(deps.ViewAppointmentService, deps.Metrics, deps.Logger))
			ar.Post("/{appointmentId}/participants", newJoinParticipantHandler(deps.JoinParticipantService, deps.Metrics, deps.Logger))
			ar.Put("/{appointmentId}/participants/{participantId}/responses", newSubmitResponsesHandler(deps.SubmitResponsesService, deps.Metrics, deps.Logger))
		})

		api.Get("/templates", newListTemplatesHandler(deps.ListTemplatesService, deps.Logger))
	})

	return r
}
