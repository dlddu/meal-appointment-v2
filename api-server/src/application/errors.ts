// Implemented for spec: agent/specs/meal-appointment-create-appointment-backend-spec.md

export interface FieldError {
  field: string;
  message: string;
}

export class ApplicationError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: { errors?: FieldError[] }
  ) {
    super(message);
  }
}

export class ValidationApplicationError extends ApplicationError {
  constructor(errors: FieldError[]) {
    super(400, 'VALIDATION_ERROR', 'Validation failed', { errors });
  }
}

export class ServiceUnavailableApplicationError extends ApplicationError {
  constructor() {
    super(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable');
  }
}

export class AppointmentNotFoundApplicationError extends ApplicationError {
  constructor() {
    super(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
  }
}

export class NicknameTakenApplicationError extends ApplicationError {
  constructor() {
    super(409, 'NICKNAME_TAKEN', 'Nickname is already taken for this appointment');
  }
}

export class InvalidPinApplicationError extends ApplicationError {
  constructor() {
    super(403, 'INVALID_PIN', 'Provided PIN is invalid');
  }
}

export class ParticipantMismatchApplicationError extends ApplicationError {
  constructor() {
    super(403, 'PARTICIPANT_MISMATCH', 'Participant information does not match');
  }
}

export class InvalidSlotApplicationError extends ApplicationError {
  constructor(invalidSlots: string[]) {
    super(400, 'INVALID_SLOT', 'One or more slots are invalid', { errors: invalidSlots.map((slot) => ({ field: 'availableSlots', message: slot })) });
  }
}

export class InternalServerApplicationError extends ApplicationError {
  constructor() {
    super(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
