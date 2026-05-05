// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md
// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md
// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/app"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/config"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/logger"
)

func main() {
	if envFile := os.Getenv("ENV_FILE"); envFile != "" {
		if err := config.LoadDotEnv(envFile); err != nil {
			fmt.Fprintf(os.Stderr, "load env file: %v\n", err)
			os.Exit(1)
		}
	} else {
		_ = config.LoadDotEnv(".env.local")
		_ = config.LoadDotEnv(".env")
	}

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "load config: %v\n", err)
		os.Exit(1)
	}

	log := logger.New()

	database, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		log.Error().Err(err).Msg("Failed to open database")
		os.Exit(1)
	}
	defer database.Close()

	if err := database.PingContext(context.Background()); err != nil {
		log.Error().Err(err).Msg("Failed to ping database")
		os.Exit(1)
	}

	container := app.Build(database, log)

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           container.Handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	idleConnsClosed := make(chan struct{})
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Error().Err(err).Msg("HTTP server shutdown error")
		}
		close(idleConnsClosed)
	}()

	log.Info().Int("port", cfg.Port).Msg("API server listening")
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error().Err(err).Msg("HTTP server error")
		os.Exit(1)
	}
	<-idleConnsClosed
}
