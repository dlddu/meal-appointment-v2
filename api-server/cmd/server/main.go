package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/health"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/participants"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/templates"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/logger"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repository"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/presentation"
)

func main() {
	loadEnvFiles()

	log := logger.New(os.Getenv("LOG_LEVEL"))
	slog.SetDefault(log)

	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	dbClient, err := db.Open(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Error("Failed to open database", slog.Any("err", err))
		os.Exit(1)
	}
	defer dbClient.Close()

	m := metrics.NewPrometheus()

	appointmentRepo := repository.NewSQLAppointmentRepository(dbClient)
	templateRepo := repository.NewSQLTemplateRepository(dbClient)
	participantRepo := repository.NewSQLParticipantRepository(dbClient)
	availabilityRepo := repository.NewSQLAvailabilityRepository(dbClient)
	templateCache := repository.NewInMemoryTemplateCache(5*time.Minute, m)
	activeTemplateService := appointments.NewActiveTemplateService(repository.NewDefaultActiveTemplateProvider())
	createSvc := appointments.NewCreateAppointmentService(appointmentRepo, domain.NewShareURLBuilder(), activeTemplateService, m, log, dbClient)
	viewSvc := appointments.NewViewAppointmentService(appointmentRepo, templateRepo, participantRepo, availabilityRepo, templateCache, m, log)
	listTemplatesSvc := templates.NewListTemplatesService(templateRepo, activeTemplateService)
	timeSlotSvc := participants.NewTimeSlotTemplateService(templateRepo, templateCache, log)
	joinSvc := participants.NewJoinParticipantService(appointmentRepo, participantRepo, availabilityRepo, m, log, dbClient)
	submitSvc := participants.NewSubmitResponsesService(appointmentRepo, participantRepo, availabilityRepo, timeSlotSvc, m, log, dbClient)

	handlers := &presentation.Handlers{
		Health:            presentation.NewHealthHandler(health.NewService(dbClient), log),
		CreateAppointment: presentation.NewCreateAppointmentHandler(createSvc, activeTemplateService, log),
		ViewAppointment:   presentation.NewViewAppointmentHandler(viewSvc, m, log),
		Participation:     presentation.NewParticipationHandler(joinSvc, submitSvc, m, log),
		Templates:         presentation.NewTemplatesHandler(listTemplatesSvc, log),
	}
	router := presentation.NewRouter(handlers)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("API server listening", slog.String("port", port))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("Server error", slog.Any("err", err))
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Error("Server shutdown failed", slog.Any("err", err))
	}
}

func loadEnvFiles() {
	if path := os.Getenv("ENV_FILE"); path != "" {
		_ = godotenv.Load(path)
		return
	}
	for _, name := range []string{".env.local", ".env"} {
		if _, err := os.Stat(name); err == nil {
			_ = godotenv.Load(name)
			return
		}
	}
}
