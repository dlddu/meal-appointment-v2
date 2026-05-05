package repository

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

type AvailabilityRecord struct {
	ParticipantID string
	SlotKey       string
}

type AvailabilityRepository interface {
	ListAvailability(ctx context.Context, appointmentID string) ([]AvailabilityRecord, error)
	ListByParticipant(ctx context.Context, participantID string) ([]AvailabilityRecord, error)
	ReplaceForParticipant(ctx context.Context, q db.Querier, appointmentID, participantID string, slotKeys []string, submittedAt time.Time) error
}

type SQLAvailabilityRepository struct {
	client *db.Client
}

func NewSQLAvailabilityRepository(client *db.Client) *SQLAvailabilityRepository {
	return &SQLAvailabilityRepository{client: client}
}

func (r *SQLAvailabilityRepository) ListAvailability(ctx context.Context, appointmentID string) ([]AvailabilityRecord, error) {
	rows, err := r.client.QueryContext(ctx,
		`SELECT participant_id, slot_key FROM slot_availability
		 WHERE appointment_id = ? ORDER BY submitted_at ASC`, appointmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAvailability(rows)
}

func (r *SQLAvailabilityRepository) ListByParticipant(ctx context.Context, participantID string) ([]AvailabilityRecord, error) {
	rows, err := r.client.QueryContext(ctx,
		`SELECT participant_id, slot_key FROM slot_availability
		 WHERE participant_id = ? ORDER BY slot_key ASC`, participantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAvailability(rows)
}

func (r *SQLAvailabilityRepository) ReplaceForParticipant(ctx context.Context, q db.Querier, appointmentID, participantID string, slotKeys []string, submittedAt time.Time) error {
	if q == nil {
		q = r.client
	}
	if _, err := q.ExecContext(ctx, `DELETE FROM slot_availability WHERE participant_id = ?`, participantID); err != nil {
		return err
	}
	if len(slotKeys) == 0 {
		return nil
	}
	submittedAtStr := submittedAt.UTC().Format(time.RFC3339Nano)
	placeholders := make([]string, 0, len(slotKeys))
	args := make([]any, 0, len(slotKeys)*5)
	for _, slotKey := range slotKeys {
		placeholders = append(placeholders, "(?, ?, ?, ?, ?)")
		args = append(args, uuid.NewString(), appointmentID, participantID, slotKey, submittedAtStr)
	}
	query := `INSERT INTO slot_availability (id, appointment_id, participant_id, slot_key, submitted_at) VALUES ` +
		strings.Join(placeholders, ", ")
	_, err := q.ExecContext(ctx, query, args...)
	return err
}

func scanAvailability(rows interface {
	Next() bool
	Scan(...any) error
	Err() error
}) ([]AvailabilityRecord, error) {
	var records []AvailabilityRecord
	for rows.Next() {
		var rec AvailabilityRecord
		if err := rows.Scan(&rec.ParticipantID, &rec.SlotKey); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}
