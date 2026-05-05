// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package presentation

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/appointments"
)

type createAppointmentRequest struct {
	Title              *string `json:"title"`
	Summary            *string `json:"summary"`
	TimeSlotTemplateID *string `json:"timeSlotTemplateId"`
}

func newCreateAppointmentHandler(service *appointments.CreateAppointmentService, logger zerolog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req createAppointmentRequest
		if err := decodeJSON(r, &req); err != nil {
			WriteAppError(w, r, logger, application.NewValidationError([]application.FieldError{
				{Field: "body", Message: "Request body must be valid JSON"},
			}))
			return
		}

		title, summary, templateID, errs := validateCreateAppointmentRequest(req)
		if len(errs) > 0 {
			WriteAppError(w, r, logger, application.NewValidationError(errs))
			return
		}

		result, err := service.Execute(r.Context(), appointments.CreateAppointmentInput{
			Title:              title,
			Summary:            summary,
			TimeSlotTemplateID: templateID,
		}, RequestIDFrom(r.Context()))
		if err != nil {
			var appErr *application.AppError
			if errors.As(err, &appErr) {
				WriteAppError(w, r, logger, appErr)
				return
			}
			WriteAppError(w, r, logger, application.NewInternalServerError())
			return
		}

		WriteJSON(w, http.StatusCreated, map[string]any{
			"appointmentId":      result.AppointmentID,
			"shareUrl":           result.ShareURL,
			"title":              result.Title,
			"summary":            result.Summary,
			"timeSlotTemplateId": result.TimeSlotTemplateID,
			"createdAt":          result.CreatedAt,
		})
	}
}

func validateCreateAppointmentRequest(req createAppointmentRequest) (string, string, string, []application.FieldError) {
	var errs []application.FieldError

	title := ""
	if req.Title != nil {
		title = strings.TrimSpace(*req.Title)
	}
	if l := len([]rune(title)); l < 1 || l > 60 {
		errs = append(errs, application.FieldError{Field: "title", Message: "Title must be between 1 and 60 characters"})
	}

	summary := ""
	if req.Summary != nil {
		summary = strings.TrimSpace(*req.Summary)
	}
	if len([]rune(summary)) > 200 {
		errs = append(errs, application.FieldError{Field: "summary", Message: "Summary must be 200 characters or fewer"})
	}

	templateID := ""
	if req.TimeSlotTemplateID != nil {
		templateID = strings.TrimSpace(*req.TimeSlotTemplateID)
	}

	return title, summary, templateID, errs
}

func decodeJSON(r *http.Request, dst any) error {
	if r.Body == nil {
		return nil
	}
	dec := json.NewDecoder(r.Body)
	dec.UseNumber()
	if err := dec.Decode(dst); err != nil {
		// Allow empty body — caller will treat fields as missing.
		if err.Error() == "EOF" {
			return nil
		}
		return err
	}
	return nil
}
