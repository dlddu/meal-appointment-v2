// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

package templates

import (
	"context"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
)

type TemplateListItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type ListTemplatesService struct {
	repo            repos.TemplateRepository
	activeTemplates *appointments.ActiveTemplateService
}

func NewListTemplatesService(repo repos.TemplateRepository, active *appointments.ActiveTemplateService) *ListTemplatesService {
	return &ListTemplatesService{repo: repo, activeTemplates: active}
}

func (s *ListTemplatesService) Execute(ctx context.Context) ([]TemplateListItem, error) {
	tmpls, err := s.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	activeIDs, err := s.activeTemplates.GetActiveTemplateIDs(ctx)
	if err != nil {
		return nil, err
	}
	activeSet := make(map[string]struct{}, len(activeIDs))
	for _, id := range activeIDs {
		activeSet[id] = struct{}{}
	}

	items := make([]TemplateListItem, 0, len(tmpls))
	for _, t := range tmpls {
		status := "inactive"
		if _, ok := activeSet[t.ID]; ok {
			status = "active"
		}
		items = append(items, TemplateListItem{
			ID:          t.ID,
			Name:        t.Name,
			Description: t.Description,
			Status:      status,
		})
	}
	return items, nil
}
