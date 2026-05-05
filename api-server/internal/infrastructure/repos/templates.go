// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

package repos

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

// TemplateParsingError signals that the persisted ruleset_json could not be
// decoded into the expected schema.
type TemplateParsingError struct{}

func (TemplateParsingError) Error() string { return "Template ruleset parsing failed" }

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

type TemplateRepository interface {
	FindByID(ctx context.Context, id string) (*TemplateRecord, error)
	FindAll(ctx context.Context) ([]TemplateRecord, error)
}

type SQLiteTemplateRepository struct{ db *db.DB }

func NewSQLiteTemplateRepository(database *db.DB) *SQLiteTemplateRepository {
	return &SQLiteTemplateRepository{db: database}
}

func (r *SQLiteTemplateRepository) FindByID(ctx context.Context, id string) (*TemplateRecord, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, name, description, ruleset_json
		FROM time_slot_templates
		WHERE id = ?
	`, id)

	rec, err := scanTemplateRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &rec, nil
}

func (r *SQLiteTemplateRepository) FindAll(ctx context.Context) ([]TemplateRecord, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, description, ruleset_json
		FROM time_slot_templates
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TemplateRecord
	for rows.Next() {
		rec, err := scanTemplateRows(rows)
		if err != nil {
			// Mirror the TS findAll behavior: ignore parse errors so unrelated
			// templates still surface in the listing.
			if _, isParse := err.(TemplateParsingError); isParse {
				continue
			}
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

func scanTemplateRow(row *sql.Row) (TemplateRecord, error) {
	var rec TemplateRecord
	var description sql.NullString
	var ruleset string
	if err := row.Scan(&rec.ID, &rec.Name, &description, &ruleset); err != nil {
		return TemplateRecord{}, err
	}
	if description.Valid {
		v := description.String
		rec.Description = &v
	}
	rules, err := decodeRuleset(ruleset)
	if err != nil {
		return TemplateRecord{}, err
	}
	rec.Rules = rules
	return rec, nil
}

func scanTemplateRows(rows *sql.Rows) (TemplateRecord, error) {
	var rec TemplateRecord
	var description sql.NullString
	var ruleset string
	if err := rows.Scan(&rec.ID, &rec.Name, &description, &ruleset); err != nil {
		return TemplateRecord{}, err
	}
	if description.Valid {
		v := description.String
		rec.Description = &v
	}
	rules, err := decodeRuleset(ruleset)
	if err != nil {
		return TemplateRecord{}, err
	}
	rec.Rules = rules
	return rec, nil
}

func decodeRuleset(raw string) ([]TemplateRule, error) {
	if raw == "" {
		return []TemplateRule{}, nil
	}
	var rules []TemplateRule
	if err := json.Unmarshal([]byte(raw), &rules); err != nil {
		return nil, TemplateParsingError{}
	}
	if rules == nil {
		rules = []TemplateRule{}
	}
	return rules, nil
}
