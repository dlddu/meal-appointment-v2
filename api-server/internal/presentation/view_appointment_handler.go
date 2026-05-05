// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

package presentation

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
)

const viewAppointmentRouteLabel = "GET /api/appointments/:appointmentId"

func newViewAppointmentHandler(service *appointments.ViewAppointmentService, m metrics.AppointmentMetrics, logger zerolog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appointmentID := chi.URLParam(r, "appointmentId")
		requestID := RequestIDFrom(r.Context())

		result, err := service.Execute(r.Context(), appointmentID, requestID)
		if err != nil {
			var viewErr *appointments.ViewAppointmentError
			if errors.As(err, &viewErr) {
				switch viewErr.Kind {
				case "not_found":
					m.RecordHTTPRequest(viewAppointmentRouteLabel, http.StatusNotFound)
					WriteJSON(w, http.StatusNotFound, map[string]any{
						"error": map[string]any{
							"code":    "APPOINTMENT_NOT_FOUND",
							"message": "약속을 찾을 수 없습니다.",
						},
						"requestId": requestID,
					})
					return
				case "template_unavailable", "template_evaluation", "service_unavailable":
					m.RecordHTTPRequest(viewAppointmentRouteLabel, http.StatusServiceUnavailable)
					WriteJSON(w, http.StatusServiceUnavailable, map[string]any{
						"error": map[string]any{
							"code":    "SERVICE_UNAVAILABLE",
							"message": "템플릿 정보를 불러올 수 없습니다. 잠시 후 다시 시도하세요.",
						},
						"requestId": requestID,
					})
					return
				}
			}
			logger.Error().
				Str("requestId", requestID).
				Str("appointmentId", appointmentID).
				Err(err).
				Msg("Unhandled view appointment error")
			m.RecordHTTPRequest(viewAppointmentRouteLabel, http.StatusInternalServerError)
			WriteJSON(w, http.StatusInternalServerError, map[string]any{
				"error": map[string]any{
					"code":    "INTERNAL_ERROR",
					"message": "내부 오류가 발생했습니다.",
				},
				"requestId": requestID,
			})
			return
		}

		m.RecordHTTPRequest(viewAppointmentRouteLabel, http.StatusOK)
		WriteJSON(w, http.StatusOK, result)
	}
}
