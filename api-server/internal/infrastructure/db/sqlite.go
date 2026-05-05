// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

// Querier is implemented by both *sql.DB and *sql.Tx so repositories can
// share query code regardless of whether they run in a transaction.
type Querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

type DB struct {
	*sql.DB
}

func Open(databaseURL string) (*DB, error) {
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL is not set")
	}
	path := strings.TrimPrefix(databaseURL, "file:")

	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	conn.SetMaxOpenConns(1)
	for _, pragma := range []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
	} {
		if _, err := conn.Exec(pragma); err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("apply pragma %q: %w", pragma, err)
		}
	}
	return &DB{conn}, nil
}

// WithTx runs fn inside a single transaction and commits on success.
func (d *DB) WithTx(ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// IsUniqueViolation reports whether err originated from a SQLite UNIQUE
// constraint failure. modernc.org/sqlite surfaces these as plain errors with
// a stable message prefix.
func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "UNIQUE constraint failed") ||
		strings.Contains(msg, "constraint failed: UNIQUE")
}
