package presentation

import (
	"log/slog"
	"net/http"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/templates"
)

type TemplatesHandler struct {
	service *templates.ListTemplatesService
	log     *slog.Logger
}

func NewTemplatesHandler(service *templates.ListTemplatesService, log *slog.Logger) *TemplatesHandler {
	return &TemplatesHandler{service: service, log: log}
}

type templateListResponseItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
	Badge       *string `json:"badge,omitempty"`
}

func (h *TemplatesHandler) Get(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.Execute(r.Context())
	if err != nil {
		writeError(w, r, h.log, err)
		return
	}
	response := make([]templateListResponseItem, 0, len(items))
	preparing := "준비 중"
	for _, item := range items {
		entry := templateListResponseItem{
			ID:          item.ID,
			Name:        item.Name,
			Description: item.Description,
			Status:      item.Status,
		}
		if item.Status == "inactive" {
			entry.Badge = &preparing
		}
		response = append(response, entry)
	}
	writeJSON(w, http.StatusOK, map[string]any{"templates": response})
}
