package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

func main() {
	loadEnv()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL is not set.")
		os.Exit(1)
	}
	dbPath := strings.TrimPrefix(dbURL, "file:")
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "failed to create db directory: %v\n", err)
		os.Exit(1)
	}

	client, err := db.Open(dbURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open database: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	migrationPath := os.Getenv("MIGRATION_FILE")
	if migrationPath == "" {
		migrationPath = "migrations/0001_init.sql"
	}
	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to read migration file %s: %v\n", migrationPath, err)
		os.Exit(1)
	}

	if _, err := client.DB().Exec(string(sqlBytes)); err != nil {
		fmt.Fprintf(os.Stderr, "migration failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[migrate] SQLite database initialized at %s\n", dbPath)
}

func loadEnv() {
	if path := os.Getenv("ENV_FILE"); path != "" {
		_ = godotenv.Load(path)
		return
	}
	for _, candidate := range []string{".env", ".env.local", ".env.test", ".env.e2e"} {
		if _, err := os.Stat(candidate); err == nil {
			_ = godotenv.Load(candidate)
			return
		}
	}
}
