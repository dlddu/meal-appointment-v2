// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import { buildApiUrl } from '../../../utils/apiUrl.js';

export type ParticipationSlotSummary = {
  slotKey: string;
  date: string;
  mealType: string;
  availableCount: number;
  availabilityRatio: number;
};

export type ParticipationTemplateResponse = {
  appointment: {
    id: string;
    title: string;
    summary: string;
    timeSlotTemplateId: string;
  };
  template: {
    id: string;
    name: string;
    description: string;
    rules: Array<{ dayPattern: string; mealTypes: string[] }>;
  };
  aggregates: {
    participantCount: number;
    slotSummaries: ParticipationSlotSummary[];
  };
};

export type ParticipationApiError = Error & {
  status?: number;
  code?: string;
};

export async function getAppointmentTemplate(
  appointmentId: string,
  apiBaseUrl: string
): Promise<ParticipationTemplateResponse> {
  const url = buildApiUrl(apiBaseUrl, `appointments/${appointmentId}`);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const err: ParticipationApiError = new Error('Network error');
    err.code = 'NETWORK_ERROR';
    throw err;
  }

  if (!response.ok) {
    let code: string | undefined;
    try {
      const body = await response.json();
      code = body?.error?.code;
    } catch (error) {
      // ignore
    }
    const err: ParticipationApiError = new Error('Failed to fetch appointment');
    err.status = response.status;
    err.code = code;
    throw err;
  }

  return response.json();
}
