// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

export type CreateAppointmentFormState = {
  title: string;
  summary: string;
  timeSlotTemplateId: string;
  touched: {
    title: boolean;
    summary: boolean;
    template: boolean;
  };
};

export type CreateAppointmentPayload = {
  title: string;
  summary: string;
  timeSlotTemplateId: string;
};

export type CreateAppointmentSuccess = {
  appointmentId: string;
  shareUrl: string;
  title: string;
  summary: string;
  timeSlotTemplateId: string;
  createdAt: string;
};

export type ValidationErrorResponse = {
  type: 'validation';
  status: 400;
  fieldErrors: Partial<Record<'title' | 'summary' | 'timeSlotTemplateId', string>>;
};

export type ServerErrorResponse = {
  type: 'server';
  status: number;
  message: string;
};

export type NetworkError = {
  type: 'network';
  message: string;
};

export type CreateAppointmentError = ValidationErrorResponse | ServerErrorResponse | NetworkError;

export type CreateAppointmentResult = {
  payload: CreateAppointmentPayload;
  response: CreateAppointmentSuccess;
};

export type TemplateOption = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
};
