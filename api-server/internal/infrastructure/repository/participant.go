package repository

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
	Create(ctx context.Context, q db.Querier, appointmentID, nickname string, pinHash *string) (*ParticipantRecord, error)
	UpdateSubmittedAt(ctx context.Context, q db.Querier, id string, submittedAt time.Time) error
}

type SQLParticipantRepository struct {
	client *db.Client
}

func NewSQLParticipantRepository(client *db.Client) *SQLParticipantRepository {
	return &SQLParticipantRepository{client: client}
}

func (r *SQLParticipantRepository) ListByAppointment(ctx context.Context, appointmentID string) ([]ParticipantRecord, error) {
	rows, err := r.client.QueryContext(ctx,
		`SELECT id, appointment_id, nickname, pin_hash, submitted_at
		 FROM participants
		 WHERE appointment_id = ?
		 ORDER BY CASE WHEN submitted_at IS NULL THEN 1 ELSE 0 END, submitted_at ASC, created_at ASC`,
		appointmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []ParticipantRecord
	for rows.Next() {
		rec, err := scanParticipantRows(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, *rec)
	}
	return records, rows.Err()
}

func (r *SQLParticipantRepository) FindByAppointmentAndNickname(ctx context.Context, appointmentID, nickname string) (*ParticipantRecord, error) {
	row := r.client.QueryRowContext(ctx,
		`SELECT id, appointment_id, nickname, pin_hash, submitted_at
		 FROM participants
		 WHERE appointment_id = ? AND nickname = ?
		 LIMIT 1`, appointmentID, nickname)
	rec, err := scanParticipantRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return rec, err
}

func (r *SQLParticipantRepository) FindByID(ctx context.Context, id string) (*ParticipantRecord, error) {
	row := r.client.QueryRowContext(ctx,
		`SELECT id, appointment_id, nickname, pin_hash, submitted_at FROM participants WHERE id = ?`, id)
	rec, err := scanParticipantRow(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return rec, err
}

func (r *SQLParticipantRepository) Create(ctx context.Context, q db.Querier, appointmentID, nickname string, pinHash *string) (*ParticipantRecord, error) {
	if q == nil {
		q = r.client
	}
	id := uuid.NewString()
	now := time.Now().UTC().Format(time.RFC3339Nano)
	row := q.QueryRowContext(ctx,
		`INSERT INTO participants (id, appointment_id, nickname, pin_hash, submitted_at, created_at)
		 VALUES (?, ?, ?, ?, NULL, ?)
		 RETURNING id, appointment_id, nickname, pin_hash, submitted_at`,
		id, appointmentID, nickname, nullableString(pinHash), now)
	return scanParticipantRow(row)
}

func (r *SQLParticipantRepository) UpdateSubmittedAt(ctx context.Context, q db.Querier, id string, submittedAt time.Time) error {
	if q == nil {
		q = r.client
	}
	_, err := q.ExecContext(ctx,
		`UPDATE participants SET submitted_at = ? WHERE id = ?`,
		submittedAt.UTC().Format(time.RFC3339Nano), id)
	return err
}

func scanParticipantRow(row *sql.Row) (*ParticipantRecord, error) {
	var (
		rec         ParticipantRecord
		pinHash     sql.NullString
		submittedAt sql.NullString
	)
	if err := row.Scan(&rec.ID, &rec.AppointmentID, &rec.Nickname, &pinHash, &submittedAt); err != nil {
		return nil, err
	}
	applyParticipantNullables(&rec, pinHash, submittedAt)
	return &rec, nil
}

func scanParticipantRows(rows *sql.Rows) (*ParticipantRecord, error) {
	var (
		rec         ParticipantRecord
		pinHash     sql.NullString
		submittedAt sql.NullString
	)
	if err := rows.Scan(&rec.ID, &rec.AppointmentID, &rec.Nickname, &pinHash, &submittedAt); err != nil {
		return nil, err
	}
	applyParticipantNullables(&rec, pinHash, submittedAt)
	return &rec, nil
}

func applyParticipantNullables(rec *ParticipantRecord, pinHash, submittedAt sql.NullString) {
	if pinHash.Valid {
		rec.PinHash = &pinHash.String
	}
	if submittedAt.Valid && submittedAt.String != "" {
		t := parseTime(submittedAt.String)
		rec.SubmittedAt = &t
	}
}

func nullableString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}
