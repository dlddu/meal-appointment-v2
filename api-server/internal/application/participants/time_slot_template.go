// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package participants

import (
	"context"
	"errors"
	"regexp"
	"time"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/templates"
)

var slotKeyPattern = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})#([A-Z]+)$`)

type SlotValidationHelper struct {
	rules []repos.TemplateRule
}

func NewSlotValidationHelper(rules []repos.TemplateRule) *SlotValidationHelper {
	return &SlotValidationHelper{rules: rules}
}

func (h *SlotValidationHelper) IsValid(slotKey string) bool {
	match := slotKeyPattern.FindStringSubmatch(slotKey)
	if match == nil {
		return false
	}
	datePart := match[1]
	mealType := match[2]
	t, err := time.Parse("2006-01-02", datePart)
	if err != nil {
		return false
	}
	day := int(t.UTC().Weekday()) // Sunday=0..Saturday=6 — matches JS getUTCDay
	for _, rule := range h.rules {
		if matchesRule(rule, datePart, day, mealType) {
			return true
		}
	}
	return false
}

func matchesRule(rule repos.TemplateRule, datePart string, day int, mealType string) bool {
	if !containsString(rule.MealTypes, mealType) {
		return false
	}
	switch rule.DayPattern {
	case "WEEKDAY":
		return day >= 1 && day <= 5
	case "WEEKEND":
		return day == 0 || day == 6
	case "EVERYDAY":
		return true
	default:
		return rule.DayPattern == datePart
	}
}

func containsString(values []string, target string) bool {
	for _, v := range values {
		if v == target {
			return true
		}
	}
	return false
}

type TimeSlotTemplateService struct {
	repo   repos.TemplateRepository
	cache  templates.TemplateCache
	logger zerolog.Logger
}

func NewTimeSlotTemplateService(repo repos.TemplateRepository, cache templates.TemplateCache, logger zerolog.Logger) *TimeSlotTemplateService {
	return &TimeSlotTemplateService{repo: repo, cache: cache, logger: logger}
}

func (s *TimeSlotTemplateService) BuildValidator(ctx context.Context, templateID string, requestID string) (*SlotValidationHelper, error) {
	tmpl, err := s.loadTemplate(ctx, templateID, requestID)
	if err != nil {
		return nil, err
	}
	return NewSlotValidationHelper(tmpl.Rules), nil
}

func (s *TimeSlotTemplateService) loadTemplate(ctx context.Context, templateID, requestID string) (*repos.TemplateRecord, error) {
	if cached := s.cache.Get(templateID); cached != nil {
		return cached, nil
	}
	tmpl, err := s.repo.FindByID(ctx, templateID)
	if err != nil {
		s.logger.Error().
			Str("event", "template.load_failed").
			Str("templateId", templateID).
			Str("requestId", requestID).
			Err(err).
			Msg("Failed to load template for validation")
		var parsing repos.TemplateParsingError
		if errors.As(err, &parsing) {
			return nil, application.NewServiceUnavailableError()
		}
		return nil, application.NewServiceUnavailableError()
	}
	if tmpl == nil {
		return nil, application.NewServiceUnavailableError()
	}
	s.cache.Set(templateID, *tmpl)
	return tmpl, nil
}
