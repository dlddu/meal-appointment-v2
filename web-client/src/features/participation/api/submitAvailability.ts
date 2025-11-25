// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import type { ParticipationApiError, ParticipationSlotSummary } from './getAppointmentTemplate.js';

export type SubmitAvailabilityRequest = {
  nickname: string;
  pin?: string;
  availableSlots: string[];
};

export type SubmitAvailabilityResponse = {
  participantId: string;
  submittedAt: string;
  selected: string[];
  summary: {
    participantCount: number;
    slotSummaries: ParticipationSlotSummary[];
  };
};

export async function submitAvailability(
  appointmentId: string,
  participantId: string,
  payload: SubmitAvailabilityRequest,
  apiBaseUrl: string
): Promise<SubmitAvailabilityResponse> {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(`appointments/${appointmentId}/participants/${participantId}/responses`, normalizedBase);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
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
      // ignore parsing errors
    }
    const err: ParticipationApiError = new Error('Failed to submit availability');
    err.status = response.status;
    err.code = code;
    throw err;
  }

  return response.json();
}
