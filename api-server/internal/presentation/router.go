package presentation

import (
	"github.com/go-chi/chi/v5"
)

type Handlers struct {
	Health           *HealthHandler
	CreateAppointment *CreateAppointmentHandler
	ViewAppointment  *ViewAppointmentHandler
	Participation    *ParticipationHandler
	Templates        *TemplatesHandler
}

func NewRouter(h *Handlers) *chi.Mux {
	r := chi.NewRouter()
	r.Use(CORSMiddleware)
	r.Use(RequestIDMiddleware)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health.Get)
		r.Get("/templates", h.Templates.Get)

		r.Route("/appointments", func(r chi.Router) {
			r.Post("/", h.CreateAppointment.Post)
			r.Get("/{appointmentId:[A-Za-z0-9_-]+}", h.ViewAppointment.Get)
			r.Post("/{appointmentId}/participants", h.Participation.Join)
			r.Put("/{appointmentId}/participants/{participantId}/responses", h.Participation.Submit)
		})
	})

	return r
}
