package presentation

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
)

type CreateAppointmentHandler struct {
	service               *appointments.CreateAppointmentService
	activeTemplateService *appointments.ActiveTemplateService
	log                   *slog.Logger
}

func NewCreateAppointmentHandler(service *appointments.CreateAppointmentService, activeTemplateService *appointments.ActiveTemplateService, log *slog.Logger) *CreateAppointmentHandler {
	return &CreateAppointmentHandler{service: service, activeTemplateService: activeTemplateService, log: log}
}

type createAppointmentRequest struct {
	Title              json.RawMessage `json:"title"`
	Summary            json.RawMessage `json:"summary"`
	TimeSlotTemplateID json.RawMessage `json:"timeSlotTemplateId"`
}

type createAppointmentResponse struct {
	AppointmentID      string `json:"appointmentId"`
	ShareURL           string `json:"shareUrl"`
	Title              string `json:"title"`
	Summary            string `json:"summary"`
	TimeSlotTemplateID string `json:"timeSlotTemplateId"`
	CreatedAt          string `json:"createdAt"`
}

func (h *CreateAppointmentHandler) Post(w http.ResponseWriter, r *http.Request) {
	var body createAppointmentRequest
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, r, h.log, application.NewValidationError([]application.FieldError{{Field: "body", Message: "Invalid JSON body"}}))
		return
	}

	title, errs := coerceStringField("title", body.Title, true, 1, 60)
	if errs != nil {
		writeError(w, r, h.log, application.NewValidationError(errs))
		return
	}
	summary, summaryErrs := coerceOptionalStringField("summary", body.Summary, 200)
	if summaryErrs != nil {
		writeError(w, r, h.log, application.NewValidationError(summaryErrs))
		return
	}
	templateID, templateErrs := coerceStringField("timeSlotTemplateId", body.TimeSlotTemplateID, true, 1, 200)
	if templateErrs != nil {
		writeError(w, r, h.log, application.NewValidationError(templateErrs))
		return
	}

	if err := h.activeTemplateService.EnsureTemplateIsActive(r.Context(), templateID); err != nil {
		writeError(w, r, h.log, err)
		return
	}

	requestID := RequestIDFromContext(r.Context())
	result, err := h.service.Execute(r.Context(), appointments.CreateAppointmentInput{
		Title:              title,
		Summary:            summary,
		TimeSlotTemplateID: templateID,
	}, appointments.CreateAppointmentContext{RequestID: requestID})
	if err != nil {
		var appErr *application.Error
		if errors.As(err, &appErr) {
			writeError(w, r, h.log, appErr)
			return
		}
		writeError(w, r, h.log, application.NewInternalServer())
		return
	}

	writeJSON(w, http.StatusCreated, createAppointmentResponse{
		AppointmentID:      result.AppointmentID,
		ShareURL:           result.ShareURL,
		Title:              result.Title,
		Summary:            result.Summary,
		TimeSlotTemplateID: result.TimeSlotTemplateID,
		CreatedAt:          result.CreatedAt.UTC().Format(time.RFC3339Nano),
	})
}

func decodeJSON(r *http.Request, target any) error {
	if r.Body == nil {
		return nil
	}
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(target); err != nil {
		return err
	}
	return nil
}

func coerceStringField(field string, raw json.RawMessage, required bool, minLen, maxLen int) (string, []application.FieldError) {
	value, err := rawToString(raw)
	if err != nil {
		return "", []application.FieldError{{Field: field, Message: "Field must be a string"}}
	}
	value = strings.TrimSpace(value)
	if required && value == "" {
		return "", []application.FieldError{{Field: field, Message: "Field is required"}}
	}
	if len(value) < minLen || len(value) > maxLen {
		return "", []application.FieldError{{Field: field, Message: rangeMessage(field, minLen, maxLen)}}
	}
	return value, nil
}

func coerceOptionalStringField(field string, raw json.RawMessage, maxLen int) (string, []application.FieldError) {
	if len(raw) == 0 {
		return "", nil
	}
	value, err := rawToString(raw)
	if err != nil {
		return "", []application.FieldError{{Field: field, Message: "Field must be a string"}}
	}
	value = strings.TrimSpace(value)
	if len(value) > maxLen {
		return "", []application.FieldError{{Field: field, Message: "Summary must be 200 characters or fewer"}}
	}
	return value, nil
}

func rangeMessage(field string, minLen, maxLen int) string {
	switch field {
	case "title":
		return "Title must be between 1 and 60 characters"
	case "nickname":
		return "Nickname must be between 1 and 30 characters"
	case "pin":
		return "PIN must be at least 4 characters"
	}
	return "Value out of range"
}

func rawToString(raw json.RawMessage) (string, error) {
	if len(raw) == 0 {
		return "", nil
	}
	if raw[0] == '"' {
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return "", err
		}
		return s, nil
	}
	if raw[0] == 'n' {
		return "", nil
	}
	return string(raw), nil
}
