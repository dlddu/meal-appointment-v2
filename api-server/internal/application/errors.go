package application

import "fmt"

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type Error struct {
	StatusCode int
	Code       string
	Message    string
	FieldErrors []FieldError
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func NewValidationError(errors []FieldError) *Error {
	return &Error{
		StatusCode:  400,
		Code:        "VALIDATION_ERROR",
		Message:     "Validation failed",
		FieldErrors: errors,
	}
}

func NewServiceUnavailable() *Error {
	return &Error{StatusCode: 503, Code: "SERVICE_UNAVAILABLE", Message: "Service temporarily unavailable"}
}

func NewAppointmentNotFound() *Error {
	return &Error{StatusCode: 404, Code: "APPOINTMENT_NOT_FOUND", Message: "Appointment not found"}
}

func NewNicknameTaken() *Error {
	return &Error{StatusCode: 409, Code: "NICKNAME_TAKEN", Message: "Nickname is already taken for this appointment"}
}

func NewInvalidPin() *Error {
	return &Error{StatusCode: 403, Code: "INVALID_PIN", Message: "Provided PIN is invalid"}
}

func NewParticipantMismatch() *Error {
	return &Error{StatusCode: 403, Code: "PARTICIPANT_MISMATCH", Message: "Participant information does not match"}
}

func NewInvalidSlots(invalidSlots []string) *Error {
	fields := make([]FieldError, 0, len(invalidSlots))
	for _, slot := range invalidSlots {
		fields = append(fields, FieldError{Field: "availableSlots", Message: slot})
	}
	return &Error{StatusCode: 400, Code: "INVALID_SLOT", Message: "One or more slots are invalid", FieldErrors: fields}
}

func NewInternalServer() *Error {
	return &Error{StatusCode: 500, Code: "INTERNAL_SERVER_ERROR", Message: "Internal server error"}
}
