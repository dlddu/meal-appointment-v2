//go:build integration

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/app"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

// migrationSQL is the schema applied to each integration test database.
const migrationSQL = `
CREATE TABLE IF NOT EXISTS "time_slot_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ruleset_json" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "time_slot_template_id" TEXT NOT NULL,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    "updated_at" TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS "participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointment_id" TEXT NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
    "nickname" TEXT NOT NULL,
    "pin_hash" TEXT,
    "submitted_at" TEXT,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE ("appointment_id", "nickname")
);
CREATE TABLE IF NOT EXISTS "slot_availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointment_id" TEXT NOT NULL REFERENCES "appointments"("id") ON DELETE CASCADE,
    "participant_id" TEXT NOT NULL REFERENCES "participants"("id") ON DELETE CASCADE,
    "slot_key" TEXT NOT NULL,
    "submitted_at" TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE ("appointment_id", "slot_key", "participant_id")
);
`

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	if _, err := database.ExecContext(context.Background(), migrationSQL); err != nil {
		t.Fatalf("apply schema: %v", err)
	}
	if _, err := database.ExecContext(context.Background(),
		`INSERT INTO time_slot_templates (id, name, description, ruleset_json) VALUES (?, ?, ?, ?)`,
		"default_weekly", "주간 기본 템플릿", "test seed",
		`[{"dayPattern":"WEEKDAY","mealTypes":["DINNER"]},{"dayPattern":"WEEKEND","mealTypes":["LUNCH","DINNER"]}]`,
	); err != nil {
		t.Fatalf("seed default template: %v", err)
	}

	logger := zerolog.New(os.Stderr).Level(zerolog.WarnLevel)
	container := app.Build(database, logger)
	srv := httptest.NewServer(container.Handler)
	t.Cleanup(srv.Close)
	return srv
}

func TestCreateAndViewAppointment(t *testing.T) {
	srv := newTestServer(t)

	// Create
	body, _ := json.Marshal(map[string]any{
		"title":              "Lunch",
		"summary":            "Weekly sync",
		"timeSlotTemplateId": "default_weekly",
	})
	resp, err := http.Post(srv.URL+"/api/appointments", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d, want 201", resp.StatusCode)
	}
	var created struct {
		AppointmentID string `json:"appointmentId"`
		ShareURL      string `json:"shareUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("decode create: %v", err)
	}
	if created.AppointmentID == "" || created.ShareURL == "" {
		t.Fatalf("missing fields: %#v", created)
	}

	// View
	resp2, err := http.Get(srv.URL + "/api/appointments/" + created.AppointmentID)
	if err != nil {
		t.Fatalf("view: %v", err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("view status = %d, want 200", resp2.StatusCode)
	}
	var viewed struct {
		Appointment struct {
			ID string `json:"id"`
		} `json:"appointment"`
		Aggregates struct {
			ParticipantCount int `json:"participantCount"`
		} `json:"aggregates"`
	}
	if err := json.NewDecoder(resp2.Body).Decode(&viewed); err != nil {
		t.Fatalf("decode view: %v", err)
	}
	if viewed.Appointment.ID != created.AppointmentID {
		t.Fatalf("view returned wrong id: %s", viewed.Appointment.ID)
	}
	if viewed.Aggregates.ParticipantCount != 0 {
		t.Fatalf("expected zero participants, got %d", viewed.Aggregates.ParticipantCount)
	}
}

func TestParticipationFlow(t *testing.T) {
	srv := newTestServer(t)

	apptBody, _ := json.Marshal(map[string]any{
		"title": "Smoke", "summary": "", "timeSlotTemplateId": "default_weekly",
	})
	resp, err := http.Post(srv.URL+"/api/appointments", "application/json", bytes.NewReader(apptBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("create appointment failed: err=%v status=%v", err, resp.StatusCode)
	}
	var created struct {
		AppointmentID string `json:"appointmentId"`
	}
	json.NewDecoder(resp.Body).Decode(&created)
	resp.Body.Close()

	joinBody, _ := json.Marshal(map[string]any{"nickname": "alice", "pin": "1234"})
	jr, err := http.Post(srv.URL+"/api/appointments/"+created.AppointmentID+"/participants", "application/json", bytes.NewReader(joinBody))
	if err != nil || jr.StatusCode != http.StatusOK {
		t.Fatalf("join failed: err=%v status=%v", err, jr.StatusCode)
	}
	var join struct {
		ParticipantID string `json:"participantId"`
		HasPin        bool   `json:"hasPin"`
	}
	json.NewDecoder(jr.Body).Decode(&join)
	jr.Body.Close()
	if !join.HasPin {
		t.Fatal("expected hasPin true")
	}

	subBody, _ := json.Marshal(map[string]any{
		"nickname":       "alice",
		"pin":            "1234",
		"availableSlots": []string{"2024-05-13#DINNER", "2024-05-11#LUNCH"},
	})
	url := srv.URL + "/api/appointments/" + created.AppointmentID + "/participants/" + join.ParticipantID + "/responses"
	req, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(subBody))
	req.Header.Set("Content-Type", "application/json")
	sr, err := http.DefaultClient.Do(req)
	if err != nil || sr.StatusCode != http.StatusOK {
		t.Fatalf("submit failed: err=%v status=%v", err, sr.StatusCode)
	}
	sr.Body.Close()

	invalidBody, _ := json.Marshal(map[string]any{
		"nickname":       "alice",
		"pin":            "1234",
		"availableSlots": []string{"2024-05-13#LUNCH"}, // weekday lunch is not in template
	})
	req2, _ := http.NewRequest(http.MethodPut, url, bytes.NewReader(invalidBody))
	req2.Header.Set("Content-Type", "application/json")
	ir, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatalf("invalid submit error: %v", err)
	}
	if ir.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid slot, got %d", ir.StatusCode)
	}
	ir.Body.Close()
}
