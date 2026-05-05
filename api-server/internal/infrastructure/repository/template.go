package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

type TemplateRule struct {
	DayPattern string   `json:"dayPattern"`
	MealTypes  []string `json:"mealTypes"`
}

type TemplateRecord struct {
	ID          string
	Name        string
	Description *string
	Rules       []TemplateRule
}

var ErrTemplateParsing = errors.New("template ruleset parsing failed")

type TemplateRepository interface {
	FindByID(ctx context.Context, id string) (*TemplateRecord, error)
	FindAll(ctx context.Context) ([]TemplateRecord, error)
}

type SQLTemplateRepository struct {
	client *db.Client
}

func NewSQLTemplateRepository(client *db.Client) *SQLTemplateRepository {
	return &SQLTemplateRepository{client: client}
}

func (r *SQLTemplateRepository) FindByID(ctx context.Context, id string) (*TemplateRecord, error) {
	row := r.client.QueryRowContext(ctx,
		`SELECT id, name, description, ruleset_json FROM time_slot_templates WHERE id = ?`, id)
	var (
		rec     TemplateRecord
		desc    sql.NullString
		ruleset string
	)
	if err := row.Scan(&rec.ID, &rec.Name, &desc, &ruleset); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if desc.Valid {
		rec.Description = &desc.String
	}
	rules, err := parseRuleset(ruleset)
	if err != nil {
		return nil, ErrTemplateParsing
	}
	rec.Rules = rules
	return &rec, nil
}

func (r *SQLTemplateRepository) FindAll(ctx context.Context) ([]TemplateRecord, error) {
	rows, err := r.client.QueryContext(ctx,
		`SELECT id, name, description, ruleset_json FROM time_slot_templates`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []TemplateRecord
	for rows.Next() {
		var (
			rec     TemplateRecord
			desc    sql.NullString
			ruleset string
		)
		if err := rows.Scan(&rec.ID, &rec.Name, &desc, &ruleset); err != nil {
			return nil, err
		}
		if desc.Valid {
			rec.Description = &desc.String
		}
		rules, parseErr := parseRuleset(ruleset)
		if parseErr != nil {
			rec.Rules = []TemplateRule{}
		} else {
			rec.Rules = rules
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

func parseRuleset(raw string) ([]TemplateRule, error) {
	if raw == "" {
		return []TemplateRule{}, nil
	}
	var rules []TemplateRule
	if err := json.Unmarshal([]byte(raw), &rules); err != nil {
		return nil, err
	}
	return rules, nil
}
