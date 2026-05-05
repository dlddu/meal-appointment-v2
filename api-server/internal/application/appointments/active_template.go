package appointments

import (
	"context"
	"sync"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
)

type ActiveTemplateService struct {
	provider repository.ActiveTemplateProvider
	ttl      time.Duration
	now      func() time.Time

	mu        sync.Mutex
	cache     []string
	expiresAt time.Time
}

func NewActiveTemplateService(provider repository.ActiveTemplateProvider) *ActiveTemplateService {
	return &ActiveTemplateService{
		provider: provider,
		ttl:      5 * time.Minute,
		now:      time.Now,
	}
}

func (s *ActiveTemplateService) GetActiveTemplateIDs(ctx context.Context) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current := s.now()
	if s.cache != nil && s.expiresAt.After(current) {
		return s.cache, nil
	}
	templates, err := s.provider.LoadActiveTemplateIDs(ctx)
	if err != nil {
		return nil, err
	}
	s.cache = templates
	s.expiresAt = current.Add(s.ttl)
	return s.cache, nil
}

func (s *ActiveTemplateService) EnsureTemplateIsActive(ctx context.Context, templateID string) error {
	templates, err := s.GetActiveTemplateIDs(ctx)
	if err != nil {
		return application.NewServiceUnavailable()
	}
	for _, id := range templates {
		if id == templateID {
			return nil
		}
	}
	return application.NewValidationError([]application.FieldError{
		{Field: "timeSlotTemplateId", Message: "Provided template is not active"},
	})
}

func (s *ActiveTemplateService) InvalidateCache() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache = nil
	s.expiresAt = time.Time{}
}
