package presentation

import (
	"net/http"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/health"
)

func newHealthHandler(svc *health.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		result, err := svc.Check(r.Context())
		if err != nil {
			WriteJSON(w, http.StatusServiceUnavailable, map[string]any{
				"status":    "error",
				"requestId": RequestIDFrom(r.Context()),
			})
			return
		}
		WriteJSON(w, http.StatusOK, result)
	}
}
