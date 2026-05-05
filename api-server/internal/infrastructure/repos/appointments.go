// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

package repos

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

type AppointmentRecord struct {
	ID                 string
	Title              string
	Summary            string
	TimeSlotTemplateID string
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type CreateAppointmentInput struct {
	Title              string
	Summary            string
	TimeSlotTemplateID string
}

type AppointmentRepository interface {
	Create(ctx context.Context, q db.Querier, input CreateAppointmentInput) (AppointmentRecord, error)
	FindByID(ctx context.Context, id string) (*AppointmentRecord, error)
}

type SQLiteAppointmentRepository struct {
	db *db.DB
}

func NewSQLiteAppointmentRepository(database *db.DB) *SQLiteAppointmentRepository {
	return &SQLiteAppointmentRepository{db: database}
}

func (r *SQLiteAppointmentRepository) Create(ctx context.Context, q db.Querier, input CreateAppointmentInput) (AppointmentRecord, error) {
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := q.ExecContext(ctx, `
		INSERT INTO appointments (id, title, summary, time_slot_template_id, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, input.Title, input.Summary, input.TimeSlotTemplateID, now, now); err != nil {
		return AppointmentRecord{}, err
	}

	return AppointmentRecord{
		ID:                 id,
		Title:              input.Title,
		Summary:            input.Summary,
		TimeSlotTemplateID: input.TimeSlotTemplateID,
		CreatedAt:          mustParseTime(now),
		UpdatedAt:          mustParseTime(now),
	}, nil
}

func (r *SQLiteAppointmentRepository) FindByID(ctx context.Context, id string) (*AppointmentRecord, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, title, summary, time_slot_template_id, created_at, updated_at
		FROM appointments
		WHERE id = ?
	`, id)

	var rec AppointmentRecord
	var createdAt, updatedAt string
	if err := row.Scan(&rec.ID, &rec.Title, &rec.Summary, &rec.TimeSlotTemplateID, &createdAt, &updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	rec.CreatedAt = parseTime(createdAt)
	rec.UpdatedAt = parseTime(updatedAt)
	return &rec, nil
}

func parseTime(value string) time.Time {
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, value); err == nil {
			return t.UTC()
		}
	}
	return time.Time{}
}

func mustParseTime(value string) time.Time {
	t := parseTime(value)
	if t.IsZero() {
		return time.Now().UTC()
	}
	return t
}
