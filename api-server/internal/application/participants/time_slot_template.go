package participants

import (
	"context"
	"errors"
	"log/slog"
	"regexp"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
)

var slotKeyPattern = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})#([A-Z]+)$`)

type SlotValidationHelper struct {
	rules []repository.TemplateRule
}

func NewSlotValidationHelper(rules []repository.TemplateRule) *SlotValidationHelper {
	return &SlotValidationHelper{rules: rules}
}

func (h *SlotValidationHelper) IsValid(slotKey string) bool {
	match := slotKeyPattern.FindStringSubmatch(slotKey)
	if match == nil {
		return false
	}
	datePart := match[1]
	mealType := match[2]
	parsedDate, err := time.Parse("2006-01-02", datePart)
	if err != nil {
		return false
	}
	day := int(parsedDate.UTC().Weekday())
	for _, rule := range h.rules {
		if matchesRule(rule, datePart, day, mealType) {
			return true
		}
	}
	return false
}

func matchesRule(rule repository.TemplateRule, datePart string, day int, mealType string) bool {
	hasMeal := false
	for _, m := range rule.MealTypes {
		if m == mealType {
			hasMeal = true
			break
		}
	}
	if !hasMeal {
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

type TimeSlotTemplateService struct {
	repo  repository.TemplateRepository
	cache repository.TemplateCache
	log   *slog.Logger
}

func NewTimeSlotTemplateService(repo repository.TemplateRepository, cache repository.TemplateCache, log *slog.Logger) *TimeSlotTemplateService {
	return &TimeSlotTemplateService{repo: repo, cache: cache, log: log}
}

type TemplateValidationContext struct {
	RequestID string
}

func (s *TimeSlotTemplateService) BuildValidator(ctx context.Context, templateID string, opCtx TemplateValidationContext) (*SlotValidationHelper, error) {
	template, err := s.loadTemplate(ctx, templateID, opCtx)
	if err != nil {
		return nil, err
	}
	return NewSlotValidationHelper(template.Rules), nil
}

func (s *TimeSlotTemplateService) loadTemplate(ctx context.Context, templateID string, opCtx TemplateValidationContext) (*repository.TemplateRecord, error) {
	if cached := s.cache.Get(templateID); cached != nil {
		return cached, nil
	}
	template, err := s.repo.FindByID(ctx, templateID)
	if err != nil {
		s.log.Error("Failed to load template for validation",
			slog.String("event", "template.load_failed"),
			slog.String("templateId", templateID),
			slog.String("requestId", opCtx.RequestID),
			slog.Any("err", err))
		if errors.Is(err, repository.ErrTemplateParsing) {
			return nil, application.NewServiceUnavailable()
		}
		return nil, application.NewServiceUnavailable()
	}
	if template == nil {
		return nil, application.NewServiceUnavailable()
	}
	s.cache.Set(templateID, *template)
	return template, nil
}
