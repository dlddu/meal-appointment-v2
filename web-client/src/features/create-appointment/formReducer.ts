// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-spec.md

import type { CreateAppointmentFormState } from './types.js';
import { createAppointmentStrings } from './strings.js';

export type FormAction =
  | { type: 'UPDATE_FIELD'; field: 'title' | 'summary' | 'timeSlotTemplateId'; value: string }
  | { type: 'SET_TOUCHED'; field: 'title' | 'summary' | 'template'; value: boolean }
  | { type: 'TOUCH_ALL' }
  | { type: 'RESET' };

export type FieldErrors = Partial<Record<'title' | 'summary' | 'timeSlotTemplateId', string>>;

export const initialFormState: CreateAppointmentFormState = {
  title: '',
  summary: '',
  timeSlotTemplateId: '',
  touched: {
    title: false,
    summary: false,
    template: false
  }
};

function sanitizeValue(field: 'title' | 'summary' | 'timeSlotTemplateId', value: string) {
  return value;
}

export function formReducer(state: CreateAppointmentFormState, action: FormAction): CreateAppointmentFormState {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.field]: sanitizeValue(action.field, action.value),
        touched: {
          ...state.touched,
          ...(action.field === 'timeSlotTemplateId' ? { template: true } : {})
        }
      };
    case 'SET_TOUCHED':
      return {
        ...state,
        touched: {
          ...state.touched,
          [action.field]: action.value
        }
      };
    case 'TOUCH_ALL':
      return {
        ...state,
        touched: {
          title: true,
          summary: true,
          template: true
        }
      };
    case 'RESET':
      return initialFormState;
    default:
      return state;
  }
}

export function validateForm(state: CreateAppointmentFormState): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedTitle = state.title.trim();
  if (!trimmedTitle) {
    errors.title = createAppointmentStrings.form.titleRequired;
  } else if (trimmedTitle.length > 60) {
    errors.title = createAppointmentStrings.form.titleTooLong;
  }

  if (state.summary.trim().length > 200) {
    errors.summary = createAppointmentStrings.form.summaryTooLong;
  }

  if (!state.timeSlotTemplateId) {
    errors.timeSlotTemplateId = createAppointmentStrings.form.templateRequired;
  }

  return errors;
}
