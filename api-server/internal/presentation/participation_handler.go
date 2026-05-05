package presentation

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/participants"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
)

const (
	joinRouteLabel     = "POST /api/appointments/:appointmentId/participants"
	responseRouteLabel = "PUT /api/appointments/:appointmentId/participants/:participantId/responses"
)

var slotKeyRegex = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}#[A-Z]+$`)

type ParticipationHandler struct {
	joinService   *participants.JoinParticipantService
	submitService *participants.SubmitResponsesService
	metrics       metrics.AppointmentMetrics
	log           *slog.Logger
}

func NewParticipationHandler(joinService *participants.JoinParticipantService, submitService *participants.SubmitResponsesService, m metrics.AppointmentMetrics, log *slog.Logger) *ParticipationHandler {
	return &ParticipationHandler{joinService: joinService, submitService: submitService, metrics: m, log: log}
}

type joinRequest struct {
	Nickname json.RawMessage `json:"nickname"`
	Pin      *string         `json:"pin"`
}

type submitRequest struct {
	Nickname       json.RawMessage `json:"nickname"`
	Pin            *string         `json:"pin"`
	AvailableSlots []string        `json:"availableSlots"`
}

func (h *ParticipationHandler) Join(w http.ResponseWriter, r *http.Request) {
	requestID := RequestIDFromContext(r.Context())
	appointmentID := chi.URLParam(r, "appointmentId")

	var body joinRequest
	if err := decodeJSON(r, &body); err != nil {
		h.metrics.RecordHTTPRequest(joinRouteLabel, http.StatusBadRequest)
		writeError(w, r, h.log, application.NewValidationError([]application.FieldError{{Field: "body", Message: "Invalid JSON body"}}))
		return
	}

	nickname, errs := coerceStringField("nickname", body.Nickname, true, 1, 30)
	if errs != nil {
		h.logValidationFailure(requestID, errs)
		h.metrics.RecordHTTPRequest(joinRouteLabel, http.StatusBadRequest)
		writeError(w, r, h.log, application.NewValidationError(errs))
		return
	}
	pin, pinErrs := normalizePin(body.Pin)
	if pinErrs != nil {
		h.logValidationFailure(requestID, pinErrs)
		h.metrics.RecordHTTPRequest(joinRouteLabel, http.StatusBadRequest)
		writeError(w, r, h.log, application.NewValidationError(pinErrs))
		return
	}

	result, err := h.joinService.Execute(r.Context(), participants.JoinParticipantInput{
		AppointmentID: appointmentID,
		Nickname:      nickname,
		Pin:           pin,
	}, participants.JoinParticipantContext{RequestID: requestID})
	if err != nil {
		var appErr *application.Error
		if errors.As(err, &appErr) {
			h.metrics.RecordHTTPRequest(joinRouteLabel, appErr.StatusCode)
			writeError(w, r, h.log, appErr)
			return
		}
		h.metrics.RecordHTTPRequest(joinRouteLabel, http.StatusInternalServerError)
		writeError(w, r, h.log, application.NewInternalServer())
		return
	}
	h.metrics.RecordHTTPRequest(joinRouteLabel, http.StatusOK)
	writeJSON(w, http.StatusOK, result)
}

func (h *ParticipationHandler) Submit(w http.ResponseWriter, r *http.Request) {
	requestID := RequestIDFromContext(r.Context())
	appointmentID := chi.URLParam(r, "appointmentId")
	participantID := chi.URLParam(r, "participantId")

	var body submitRequest
	if err := decodeJSON(r, &body); err != nil {
		h.metrics.RecordHTTPRequest(responseRouteLabel, http.StatusBadRequest)
		writeError(w, r, h.log, application.NewValidationError([]application.FieldError{{Field: "body", Message: "Invalid JSON body"}}))
		return
	}

	nickname, errs := coerceStringField("nickname", body.Nickname, true, 1, 30)
	if errs != nil {
		h.logValidationFailure(requestID, errs)
		h.metrics.RecordHTTPRequest(responseRouteLabel, http.StatusBadRequest)
		writeError(w, r, h.log, application.NewValidationError(errs))
		return
	}
	pin, pinErrs := normalizePin(body.Pin)
	if pinErrs != nil {
		h.logValidationFailure(requestID, pinErrs)
		h.metrics.RecordHTTPRequest(responseRouteLabel, http.StatusBadRequest)
		writeError(w, r, h.log, application.NewValidationError(pinErrs))
		return
	}
	slots, slotErrs := normalizeSlots(body.AvailableSlots)
	if slotErrs != nil {
		h.logValidationFailure(requestID, slotErrs)
		h.metrics.RecordHTTPRequest(responseRouteLabel, http.StatusBadRequest)
		writeError(w, r, h.log, application.NewValidationError(slotErrs))
		return
	}

	result, err := h.submitService.Execute(r.Context(), participants.SubmitResponsesInput{
		AppointmentID:  appointmentID,
		ParticipantID:  participantID,
		Nickname:       nickname,
		Pin:            pin,
		AvailableSlots: slots,
	}, participants.SubmitResponsesContext{RequestID: requestID})
	if err != nil {
		var appErr *application.Error
		if errors.As(err, &appErr) {
			h.metrics.RecordHTTPRequest(responseRouteLabel, appErr.StatusCode)
			writeError(w, r, h.log, appErr)
			return
		}
		h.metrics.RecordHTTPRequest(responseRouteLabel, http.StatusInternalServerError)
		writeError(w, r, h.log, application.NewInternalServer())
		return
	}
	h.metrics.RecordHTTPRequest(responseRouteLabel, http.StatusOK)
	writeJSON(w, http.StatusOK, result)
}

func (h *ParticipationHandler) logValidationFailure(requestID string, errs []application.FieldError) {
	h.log.Warn("Participant validation failed",
		slog.String("event", "participant.validation_failed"),
		slog.Any("errors", errs),
		slog.String("requestId", requestID))
}

func normalizePin(pin *string) (string, []application.FieldError) {
	if pin == nil {
		return "", nil
	}
	value := strings.TrimSpace(*pin)
	if value == "" {
		return "", nil
	}
	if len(value) < 4 {
		return "", []application.FieldError{{Field: "pin", Message: "PIN must be at least 4 characters"}}
	}
	if len(value) > 12 {
		return "", []application.FieldError{{Field: "pin", Message: "PIN must be at most 12 characters"}}
	}
	return value, nil
}

func normalizeSlots(slots []string) ([]string, []application.FieldError) {
	normalized := make([]string, 0, len(slots))
	seen := make(map[string]struct{}, len(slots))
	duplicate := false
	for _, slot := range slots {
		trimmed := strings.TrimSpace(slot)
		if !slotKeyRegex.MatchString(trimmed) {
			return nil, []application.FieldError{{Field: "availableSlots", Message: "Slot key must match YYYY-MM-DD#MEAL format"}}
		}
		if _, ok := seen[trimmed]; ok {
			duplicate = true
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	if duplicate {
		return nil, []application.FieldError{{Field: "availableSlots", Message: "Duplicate slots are not allowed"}}
	}
	return normalized, nil
}
