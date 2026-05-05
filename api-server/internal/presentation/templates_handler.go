// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

package presentation

import (
	"net/http"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	templatesapp "github.com/dlddu/meal-appointment-v2/api-server/internal/application/templates"
)

func newListTemplatesHandler(service *templatesapp.ListTemplatesService, logger zerolog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		items, err := service.Execute(r.Context())
		if err != nil {
			WriteAppError(w, r, logger, application.NewInternalServerError())
			return
		}

		out := make([]map[string]any, 0, len(items))
		for _, item := range items {
			entry := map[string]any{
				"id":          item.ID,
				"name":        item.Name,
				"description": item.Description,
				"status":      item.Status,
			}
			if item.Status == "inactive" {
				entry["badge"] = "준비 중"
			}
			out = append(out, entry)
		}

		WriteJSON(w, http.StatusOK, map[string]any{"templates": out})
	}
}
