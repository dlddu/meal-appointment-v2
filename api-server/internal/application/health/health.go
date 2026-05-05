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
	client *db.Client
}

func NewService(client *db.Client) *Service {
	return &Service{client: client}
}

func (s *Service) Check(ctx context.Context) (Result, error) {
	if err := s.client.Ping(ctx); err != nil {
		return Result{}, err
	}
	return Result{Status: "ok", Timestamp: time.Now().UTC().Format(time.RFC3339Nano)}, nil
}
