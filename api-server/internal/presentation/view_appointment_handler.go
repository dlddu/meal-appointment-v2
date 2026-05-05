package presentation

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
)

const viewAppointmentRoute = "GET /api/appointments/:appointmentId"

type ViewAppointmentHandler struct {
	service *appointments.ViewAppointmentService
	metrics metrics.AppointmentMetrics
	log     *slog.Logger
}

func NewViewAppointmentHandler(service *appointments.ViewAppointmentService, m metrics.AppointmentMetrics, log *slog.Logger) *ViewAppointmentHandler {
	return &ViewAppointmentHandler{service: service, metrics: m, log: log}
}

func (h *ViewAppointmentHandler) Get(w http.ResponseWriter, r *http.Request) {
	appointmentID := chi.URLParam(r, "appointmentId")
	requestID := RequestIDFromContext(r.Context())

	result, err := h.service.Execute(r.Context(), appointmentID, appointments.ViewAppointmentContext{RequestID: requestID})
	if err != nil {
		switch {
		case errors.Is(err, appointments.ErrAppointmentNotFound):
			h.metrics.RecordHTTPRequest(viewAppointmentRoute, http.StatusNotFound)
			writeJSON(w, http.StatusNotFound, map[string]any{
				"error": map[string]string{
					"code":    "APPOINTMENT_NOT_FOUND",
					"message": "약속을 찾을 수 없습니다.",
				},
				"requestId": requestID,
			})
			return
		case errors.Is(err, appointments.ErrTemplateUnavailable),
			errors.Is(err, appointments.ErrTemplateEvaluation),
			errors.Is(err, appointments.ErrServiceUnavailable):
			h.metrics.RecordHTTPRequest(viewAppointmentRoute, http.StatusServiceUnavailable)
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"error": map[string]string{
					"code":    "SERVICE_UNAVAILABLE",
					"message": "템플릿 정보를 불러올 수 없습니다. 잠시 후 다시 시도하세요.",
				},
				"requestId": requestID,
			})
			return
		}
		h.metrics.RecordHTTPRequest(viewAppointmentRoute, http.StatusInternalServerError)
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"error": map[string]string{
				"code":    "INTERNAL_ERROR",
				"message": "내부 오류가 발생했습니다.",
			},
			"requestId": requestID,
		})
		return
	}
	h.metrics.RecordHTTPRequest(viewAppointmentRoute, http.StatusOK)
	writeJSON(w, http.StatusOK, result)
}
