// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package repos

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

type SQLiteAvailabilityRepository struct{ db *db.DB }

func NewSQLiteAvailabilityRepository(database *db.DB) *SQLiteAvailabilityRepository {
	return &SQLiteAvailabilityRepository{db: database}
}

func (r *SQLiteAvailabilityRepository) ListAvailability(ctx context.Context, appointmentID string) ([]AvailabilityRecord, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT participant_id, slot_key
		FROM slot_availability
		WHERE appointment_id = ?
		ORDER BY submitted_at ASC
	`, appointmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AvailabilityRecord
	for rows.Next() {
		var rec AvailabilityRecord
		if err := rows.Scan(&rec.ParticipantID, &rec.SlotKey); err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

func (r *SQLiteAvailabilityRepository) ListByParticipant(ctx context.Context, participantID string) ([]AvailabilityRecord, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT participant_id, slot_key
		FROM slot_availability
		WHERE participant_id = ?
		ORDER BY slot_key ASC
	`, participantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AvailabilityRecord
	for rows.Next() {
		var rec AvailabilityRecord
		if err := rows.Scan(&rec.ParticipantID, &rec.SlotKey); err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

func (r *SQLiteAvailabilityRepository) ReplaceForParticipant(ctx context.Context, q db.Querier, appointmentID, participantID string, slotKeys []string, submittedAt time.Time) error {
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

	stmt := `
		INSERT INTO slot_availability (id, appointment_id, participant_id, slot_key, submitted_at)
		VALUES ` + strings.Join(placeholders, ", ")
	_, err := q.ExecContext(ctx, stmt, args...)
	return err
}
