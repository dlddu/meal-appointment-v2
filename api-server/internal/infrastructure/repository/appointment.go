package repository

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
	Create(ctx context.Context, q db.Querier, input CreateAppointmentInput) (*AppointmentRecord, error)
	FindByID(ctx context.Context, id string) (*AppointmentRecord, error)
}

type SQLAppointmentRepository struct {
	client *db.Client
}

func NewSQLAppointmentRepository(client *db.Client) *SQLAppointmentRepository {
	return &SQLAppointmentRepository{client: client}
}

func (r *SQLAppointmentRepository) Create(ctx context.Context, q db.Querier, input CreateAppointmentInput) (*AppointmentRecord, error) {
	if q == nil {
		q = r.client
	}
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	row := q.QueryRowContext(ctx,
		`INSERT INTO appointments (id, title, summary, time_slot_template_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 RETURNING id, title, summary, time_slot_template_id, created_at, updated_at`,
		id, input.Title, input.Summary, input.TimeSlotTemplateID, now, now)
	return scanAppointment(row)
}

func (r *SQLAppointmentRepository) FindByID(ctx context.Context, id string) (*AppointmentRecord, error) {
	row := r.client.QueryRowContext(ctx,
		`SELECT id, title, summary, time_slot_template_id, created_at, updated_at
		 FROM appointments WHERE id = ?`, id)
	rec, err := scanAppointment(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return rec, err
}

func scanAppointment(row *sql.Row) (*AppointmentRecord, error) {
	var (
		rec       AppointmentRecord
		createdAt string
		updatedAt string
	)
	if err := row.Scan(&rec.ID, &rec.Title, &rec.Summary, &rec.TimeSlotTemplateID, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	rec.CreatedAt = parseTime(createdAt)
	rec.UpdatedAt = parseTime(updatedAt)
	return &rec, nil
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}
