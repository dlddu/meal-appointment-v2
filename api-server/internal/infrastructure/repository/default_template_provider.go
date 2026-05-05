package repository

import "context"

type ActiveTemplateProvider interface {
	LoadActiveTemplateIDs(ctx context.Context) ([]string, error)
}

type DefaultActiveTemplateProvider struct{}

func NewDefaultActiveTemplateProvider() *DefaultActiveTemplateProvider {
	return &DefaultActiveTemplateProvider{}
}

func (p *DefaultActiveTemplateProvider) LoadActiveTemplateIDs(_ context.Context) ([]string, error) {
	return []string{"default_weekly"}, nil
}
