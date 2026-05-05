package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"
)

type Querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type Client struct {
	db *sql.DB
}

func Open(databaseURL string) (*Client, error) {
	if databaseURL == "" {
		return nil, errors.New("DATABASE_URL is not set")
	}
	dsn := strings.TrimPrefix(databaseURL, "file:")
	dsn = fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)&_pragma=busy_timeout(5000)", dsn)

	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	conn.SetMaxOpenConns(1)
	if err := conn.Ping(); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	return &Client{db: conn}, nil
}

func (c *Client) Close() error {
	return c.db.Close()
}

func (c *Client) DB() *sql.DB {
	return c.db
}

func (c *Client) Ping(ctx context.Context) error {
	return c.db.PingContext(ctx)
}

func (c *Client) QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return c.db.QueryContext(ctx, query, args...)
}

func (c *Client) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return c.db.ExecContext(ctx, query, args...)
}

func (c *Client) QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return c.db.QueryRowContext(ctx, query, args...)
}

func (c *Client) WithTx(ctx context.Context, fn func(tx Querier) error) error {
	tx, err := c.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "UNIQUE constraint failed") ||
		strings.Contains(msg, "constraint failed: UNIQUE") ||
		strings.Contains(msg, "SQLITE_CONSTRAINT_UNIQUE") ||
		strings.Contains(msg, "code: 2067") ||
		strings.Contains(msg, "code: 1555")
}
