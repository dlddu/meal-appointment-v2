package appointments

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
)

type stubProvider struct {
	ids   []string
	calls int
	err   error
}

func (s *stubProvider) LoadActiveTemplateIDs(_ context.Context) ([]string, error) {
	s.calls++
	if s.err != nil {
		return nil, s.err
	}
	out := make([]string, len(s.ids))
	copy(out, s.ids)
	return out, nil
}

func TestActiveTemplateService_CachesResults(t *testing.T) {
	stub := &stubProvider{ids: []string{"default_weekly"}}
	svc := NewActiveTemplateService(stub, time.Minute)

	for i := 0; i < 3; i++ {
		ids, err := svc.GetActiveTemplateIDs(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(ids) != 1 || ids[0] != "default_weekly" {
			t.Fatalf("unexpected ids: %v", ids)
		}
	}
	if stub.calls != 1 {
		t.Errorf("expected provider to be called once, got %d", stub.calls)
	}
}

func TestActiveTemplateService_EnsureTemplateIsActive_Rejects(t *testing.T) {
	stub := &stubProvider{ids: []string{"default_weekly"}}
	svc := NewActiveTemplateService(stub, time.Minute)

	err := svc.EnsureTemplateIsActive(context.Background(), "demo-default")
	if err == nil {
		t.Fatal("expected error")
	}
	var appErr *application.AppError
	if !errors.As(err, &appErr) || appErr.Code != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %v", err)
	}
}
