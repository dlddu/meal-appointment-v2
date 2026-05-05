// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

package application

type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// AppError is the standard error envelope thrown by application services and
// translated by the presentation layer into JSON responses.
type AppError struct {
	StatusCode int
	Code       string
	Message    string
	Errors     []FieldError
}

func (e *AppError) Error() string { return e.Message }

func NewValidationError(errs []FieldError) *AppError {
	return &AppError{StatusCode: 400, Code: "VALIDATION_ERROR", Message: "Validation failed", Errors: errs}
}

func NewServiceUnavailableError() *AppError {
	return &AppError{StatusCode: 503, Code: "SERVICE_UNAVAILABLE", Message: "Service temporarily unavailable"}
}

func NewAppointmentNotFoundError() *AppError {
	return &AppError{StatusCode: 404, Code: "APPOINTMENT_NOT_FOUND", Message: "Appointment not found"}
}

func NewNicknameTakenError() *AppError {
	return &AppError{StatusCode: 409, Code: "NICKNAME_TAKEN", Message: "Nickname is already taken for this appointment"}
}

func NewInvalidPinError() *AppError {
	return &AppError{StatusCode: 403, Code: "INVALID_PIN", Message: "Provided PIN is invalid"}
}

func NewParticipantMismatchError() *AppError {
	return &AppError{StatusCode: 403, Code: "PARTICIPANT_MISMATCH", Message: "Participant information does not match"}
}

func NewInvalidSlotError(invalidSlots []string) *AppError {
	errs := make([]FieldError, 0, len(invalidSlots))
	for _, s := range invalidSlots {
		errs = append(errs, FieldError{Field: "availableSlots", Message: s})
	}
	return &AppError{StatusCode: 400, Code: "INVALID_SLOT", Message: "One or more slots are invalid", Errors: errs}
}

func NewInternalServerError() *AppError {
	return &AppError{StatusCode: 500, Code: "INTERNAL_SERVER_ERROR", Message: "Internal server error"}
}
