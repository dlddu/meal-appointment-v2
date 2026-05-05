package presentation

import (
	"log/slog"
	"net/http"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/health"
)

type HealthHandler struct {
	service *health.Service
	log     *slog.Logger
}

func NewHealthHandler(service *health.Service, log *slog.Logger) *HealthHandler {
	return &HealthHandler{service: service, log: log}
}

func (h *HealthHandler) Get(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.Check(r.Context())
	if err != nil {
		writeError(w, r, h.log, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
