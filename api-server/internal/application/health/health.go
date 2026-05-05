package health

import (
	"context"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

type Result struct {
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
}

type Service struct {
	db *db.DB
}

func NewService(database *db.DB) *Service { return &Service{db: database} }

func (s *Service) Check(ctx context.Context) (Result, error) {
	if _, err := s.db.ExecContext(ctx, "SELECT 1"); err != nil {
		return Result{}, err
	}
	return Result{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format("2006-01-02T15:04:05.000Z07:00"),
	}, nil
}
