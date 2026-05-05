// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package appointments

import (
	"context"
	"sync"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/templates"
)

type ActiveTemplateService struct {
	provider templates.ActiveTemplateProvider
	ttl      time.Duration
	now      func() time.Time

	mu       sync.Mutex
	cached   []string
	expireAt time.Time
	hasCache bool
}

func NewActiveTemplateService(provider templates.ActiveTemplateProvider, ttl time.Duration) *ActiveTemplateService {
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	return &ActiveTemplateService{provider: provider, ttl: ttl, now: time.Now}
}

func (s *ActiveTemplateService) GetActiveTemplateIDs(ctx context.Context) ([]string, error) {
	s.mu.Lock()
	if s.hasCache && s.expireAt.After(s.now()) {
		out := append([]string(nil), s.cached...)
		s.mu.Unlock()
		return out, nil
	}
	s.mu.Unlock()

	ids, err := s.provider.LoadActiveTemplateIDs(ctx)
	if err != nil {
		return nil, err
	}
	s.mu.Lock()
	s.cached = append([]string(nil), ids...)
	s.expireAt = s.now().Add(s.ttl)
	s.hasCache = true
	s.mu.Unlock()
	return ids, nil
}

func (s *ActiveTemplateService) EnsureTemplateIsActive(ctx context.Context, templateID string) error {
	ids, err := s.GetActiveTemplateIDs(ctx)
	if err != nil {
		return err
	}
	for _, id := range ids {
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
	s.hasCache = false
	s.cached = nil
}
