// Implemented for spec: agent/specs/meal-appointment-local-testing-spec.md

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/config"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

func main() {
	if envFile := os.Getenv("ENV_FILE"); envFile != "" {
		if err := config.LoadDotEnv(envFile); err != nil {
			fmt.Fprintf(os.Stderr, "load env file: %v\n", err)
			os.Exit(1)
		}
	}

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if cfg.DatabaseURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is not set.")
		os.Exit(1)
	}
	dbPath := strings.TrimPrefix(cfg.DatabaseURL, "file:")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "create db dir: %v\n", err)
		os.Exit(1)
	}

	migrationPath := os.Getenv("MIGRATION_FILE")
	if migrationPath == "" {
		migrationPath = "migrations/0001_init.sql"
	}
	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read migration file %q: %v\n", migrationPath, err)
		os.Exit(1)
	}

	database, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open database: %v\n", err)
		os.Exit(1)
	}
	defer database.Close()

	if _, err := database.Exec(string(sqlBytes)); err != nil {
		fmt.Fprintf(os.Stderr, "apply migration: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("[migrate] SQLite database initialized at %s\n", dbPath)
}
