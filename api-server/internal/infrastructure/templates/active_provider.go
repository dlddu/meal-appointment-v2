// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package templates

import "context"

// ActiveTemplateProvider returns the IDs of templates currently considered active.
type ActiveTemplateProvider interface {
	LoadActiveTemplateIDs(ctx context.Context) ([]string, error)
}

type DefaultActiveTemplateProvider struct{}

func NewDefaultActiveTemplateProvider() *DefaultActiveTemplateProvider {
	return &DefaultActiveTemplateProvider{}
}

func (DefaultActiveTemplateProvider) LoadActiveTemplateIDs(_ context.Context) ([]string, error) {
	return []string{"default_weekly"}, nil
}
