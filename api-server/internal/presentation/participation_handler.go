// Implemented for spec: agent/specs/meal-appointment-participation-backend-implementation-spec.md

package presentation

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/application"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/application/participants"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/metrics"
)

const (
	joinRouteLabel     = "POST /api/appointments/:appointmentId/participants"
	responseRouteLabel = "PUT /api/appointments/:appointmentId/participants/:participantId/responses"
)

var slotKeyFormat = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}#[A-Z]+$`)

type joinParticipantRequest struct {
	Nickname *string `json:"nickname"`
	Pin      *string `json:"pin"`
}

type submitResponsesRequest struct {
	Nickname       *string  `json:"nickname"`
	Pin            *string  `json:"pin"`
	AvailableSlots []string `json:"availableSlots"`
}

func newJoinParticipantHandler(service *participants.JoinParticipantService, m metrics.AppointmentMetrics, logger zerolog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appointmentID := chi.URLParam(r, "appointmentId")
		requestID := RequestIDFrom(r.Context())

		var req joinParticipantRequest
		if err := decodeJSON(r, &req); err != nil {
			m.RecordHTTPRequest(joinRouteLabel, http.StatusBadRequest)
			WriteAppError(w, r, logger, application.NewValidationError([]application.FieldError{
				{Field: "body", Message: "Request body must be valid JSON"},
			}))
			return
		}

		nickname, pin, errs := validateNicknameAndPin(req.Nickname, req.Pin)
		if len(errs) > 0 {
			logger.Warn().Str("event", "participant.validation_failed").Str("requestId", requestID).Send()
			m.RecordHTTPRequest(joinRouteLabel, http.StatusBadRequest)
			WriteAppError(w, r, logger, application.NewValidationError(errs))
			return
		}

		result, err := service.Execute(r.Context(), participants.JoinParticipantInput{
			AppointmentID: appointmentID,
			Nickname:      nickname,
			Pin:           pin,
		}, requestID)
		if err != nil {
			var appErr *application.AppError
			if errors.As(err, &appErr) {
				m.RecordHTTPRequest(joinRouteLabel, appErr.StatusCode)
				WriteAppError(w, r, logger, appErr)
				return
			}
			m.RecordHTTPRequest(joinRouteLabel, http.StatusInternalServerError)
			WriteAppError(w, r, logger, application.NewInternalServerError())
			return
		}

		m.RecordHTTPRequest(joinRouteLabel, http.StatusOK)
		WriteJSON(w, http.StatusOK, result)
	}
}

func newSubmitResponsesHandler(service *participants.SubmitResponsesService, m metrics.AppointmentMetrics, logger zerolog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		appointmentID := chi.URLParam(r, "appointmentId")
		participantID := chi.URLParam(r, "participantId")
		requestID := RequestIDFrom(r.Context())

		var req submitResponsesRequest
		if err := decodeJSON(r, &req); err != nil {
			m.RecordHTTPRequest(responseRouteLabel, http.StatusBadRequest)
			WriteAppError(w, r, logger, application.NewValidationError([]application.FieldError{
				{Field: "body", Message: "Request body must be valid JSON"},
			}))
			return
		}

		nickname, pin, errs := validateNicknameAndPin(req.Nickname, req.Pin)

		if req.AvailableSlots == nil {
			errs = append(errs, application.FieldError{Field: "availableSlots", Message: "availableSlots is required"})
		}

		normalizedSlots := make([]string, 0, len(req.AvailableSlots))
		seen := make(map[string]struct{})
		duplicate := false
		for _, slot := range req.AvailableSlots {
			trimmed := strings.TrimSpace(slot)
			if !slotKeyFormat.MatchString(trimmed) {
				errs = append(errs, application.FieldError{Field: "availableSlots", Message: "Slot key must match YYYY-MM-DD#MEAL format"})
			}
			if _, ok := seen[trimmed]; ok {
				duplicate = true
			}
			seen[trimmed] = struct{}{}
			normalizedSlots = append(normalizedSlots, trimmed)
		}
		if duplicate {
			errs = append(errs, application.FieldError{Field: "availableSlots", Message: "Duplicate slots are not allowed"})
		}

		if len(errs) > 0 {
			logger.Warn().Str("event", "participant.validation_failed").Str("requestId", requestID).Send()
			m.RecordHTTPRequest(responseRouteLabel, http.StatusBadRequest)
			WriteAppError(w, r, logger, application.NewValidationError(errs))
			return
		}

		result, err := service.Execute(r.Context(), participants.SubmitResponsesInput{
			AppointmentID:  appointmentID,
			ParticipantID:  participantID,
			Nickname:       nickname,
			Pin:            pin,
			AvailableSlots: normalizedSlots,
		}, requestID)
		if err != nil {
			var appErr *application.AppError
			if errors.As(err, &appErr) {
				m.RecordHTTPRequest(responseRouteLabel, appErr.StatusCode)
				WriteAppError(w, r, logger, appErr)
				return
			}
			m.RecordHTTPRequest(responseRouteLabel, http.StatusInternalServerError)
			WriteAppError(w, r, logger, application.NewInternalServerError())
			return
		}

		m.RecordHTTPRequest(responseRouteLabel, http.StatusOK)
		WriteJSON(w, http.StatusOK, result)
	}
}

func validateNicknameAndPin(rawNickname, rawPin *string) (string, string, []application.FieldError) {
	var errs []application.FieldError

	nickname := ""
	if rawNickname != nil {
		nickname = strings.TrimSpace(*rawNickname)
	}
	if l := len([]rune(nickname)); l < 1 || l > 30 {
		errs = append(errs, application.FieldError{Field: "nickname", Message: "Nickname must be between 1 and 30 characters"})
	}

	pin := ""
	if rawPin != nil {
		pin = strings.TrimSpace(*rawPin)
		if pin != "" {
			if l := len([]rune(pin)); l < 4 {
				errs = append(errs, application.FieldError{Field: "pin", Message: "PIN must be at least 4 characters"})
			} else if l > 12 {
				errs = append(errs, application.FieldError{Field: "pin", Message: "PIN must be at most 12 characters"})
			}
		}
	}

	return nickname, pin, errs
}
