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

export class InternalServerApplicationError extends ApplicationError {
  constructor() {
    super(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
