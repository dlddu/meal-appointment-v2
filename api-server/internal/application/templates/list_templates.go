package templates

import (
	"context"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
)

type TemplateListItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type ListTemplatesService struct {
	repo                  repository.TemplateRepository
	activeTemplateService *appointments.ActiveTemplateService
}

func NewListTemplatesService(repo repository.TemplateRepository, activeTemplateService *appointments.ActiveTemplateService) *ListTemplatesService {
	return &ListTemplatesService{
		repo:                  repo,
		activeTemplateService: activeTemplateService,
	}
}

func (s *ListTemplatesService) Execute(ctx context.Context) ([]TemplateListItem, error) {
	templates, err := s.repo.FindAll(ctx)
	if err != nil {
		return nil, err
	}
	activeIDs, err := s.activeTemplateService.GetActiveTemplateIDs(ctx)
	if err != nil {
		return nil, err
	}
	activeSet := make(map[string]struct{}, len(activeIDs))
	for _, id := range activeIDs {
		activeSet[id] = struct{}{}
	}
	items := make([]TemplateListItem, 0, len(templates))
	for _, t := range templates {
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
