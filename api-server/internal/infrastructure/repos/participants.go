// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package repos

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

type ParticipantRecord struct {
	ID            string
	AppointmentID string
	Nickname      string
	PinHash       *string
	SubmittedAt   *time.Time
}

type ParticipantRepository interface {
	ListByAppointment(ctx context.Context, appointmentID string) ([]ParticipantRecord, error)
	FindByAppointmentAndNickname(ctx context.Context, appointmentID, nickname string) (*ParticipantRecord, error)
	FindByID(ctx context.Context, id string) (*ParticipantRecord, error)
	Create(ctx context.Context, q db.Querier, appointmentID, nickname string, pinHash *string) (ParticipantRecord, error)
	UpdateSubmittedAt(ctx context.Context, q db.Querier, id string, submittedAt time.Time) error
}

type SQLiteParticipantRepository struct{ db *db.DB }

func NewSQLiteParticipantRepository(database *db.DB) *SQLiteParticipantRepository {
	return &SQLiteParticipantRepository{db: database}
}

func (r *SQLiteParticipantRepository) ListByAppointment(ctx context.Context, appointmentID string) ([]ParticipantRecord, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, appointment_id, nickname, pin_hash, submitted_at
		FROM participants
		WHERE appointment_id = ?
		ORDER BY CASE WHEN submitted_at IS NULL THEN 1 ELSE 0 END, submitted_at ASC, created_at ASC
	`, appointmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ParticipantRecord
	for rows.Next() {
		rec, err := scanParticipant(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

func (r *SQLiteParticipantRepository) FindByAppointmentAndNickname(ctx context.Context, appointmentID, nickname string) (*ParticipantRecord, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, appointment_id, nickname, pin_hash, submitted_at
		FROM participants
		WHERE appointment_id = ? AND nickname = ?
		LIMIT 1
	`, appointmentID, nickname)
	rec, err := scanParticipantRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &rec, nil
}

func (r *SQLiteParticipantRepository) FindByID(ctx context.Context, id string) (*ParticipantRecord, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT id, appointment_id, nickname, pin_hash, submitted_at
		FROM participants
		WHERE id = ?
	`, id)
	rec, err := scanParticipantRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &rec, nil
}

func (r *SQLiteParticipantRepository) Create(ctx context.Context, q db.Querier, appointmentID, nickname string, pinHash *string) (ParticipantRecord, error) {
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := q.ExecContext(ctx, `
		INSERT INTO participants (id, appointment_id, nickname, pin_hash, submitted_at, created_at)
		VALUES (?, ?, ?, ?, NULL, ?)
	`, id, appointmentID, nickname, pinHash, now); err != nil {
		return ParticipantRecord{}, err
	}
	return ParticipantRecord{
		ID:            id,
		AppointmentID: appointmentID,
		Nickname:      nickname,
		PinHash:       pinHash,
	}, nil
}

func (r *SQLiteParticipantRepository) UpdateSubmittedAt(ctx context.Context, q db.Querier, id string, submittedAt time.Time) error {
	_, err := q.ExecContext(ctx, `
		UPDATE participants
		SET submitted_at = ?
		WHERE id = ?
	`, submittedAt.UTC().Format(time.RFC3339Nano), id)
	return err
}

func scanParticipant(rows *sql.Rows) (ParticipantRecord, error) {
	var rec ParticipantRecord
	var pin sql.NullString
	var submittedAt sql.NullString
	if err := rows.Scan(&rec.ID, &rec.AppointmentID, &rec.Nickname, &pin, &submittedAt); err != nil {
		return ParticipantRecord{}, err
	}
	if pin.Valid {
		v := pin.String
		rec.PinHash = &v
	}
	if submittedAt.Valid {
		t := parseTime(submittedAt.String)
		rec.SubmittedAt = &t
	}
	return rec, nil
}

func scanParticipantRow(row *sql.Row) (ParticipantRecord, error) {
	var rec ParticipantRecord
	var pin sql.NullString
	var submittedAt sql.NullString
	if err := row.Scan(&rec.ID, &rec.AppointmentID, &rec.Nickname, &pin, &submittedAt); err != nil {
		return ParticipantRecord{}, err
	}
	if pin.Valid {
		v := pin.String
		rec.PinHash = &v
	}
	if submittedAt.Valid {
		t := parseTime(submittedAt.String)
		rec.SubmittedAt = &t
	}
	return rec, nil
}
