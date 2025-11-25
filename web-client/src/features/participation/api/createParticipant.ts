// Implemented for spec: agent/specs/meal-appointment-participation-frontend-implementation-spec.md

import type { ParticipationApiError } from './getAppointmentTemplate.js';

export type CreateParticipantRequest = {
  nickname: string;
  pin?: string;
};

export type CreateParticipantResponse = {
  participantId: string;
  nickname: string;
  hasPin: boolean;
  submittedAt: string | null;
  responses: string[];
};

export async function createParticipant(
  appointmentId: string,
  payload: CreateParticipantRequest,
  apiBaseUrl: string
): Promise<CreateParticipantResponse> {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(`appointments/${appointmentId}/participants`, normalizedBase);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
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
    const err: ParticipationApiError = new Error('Failed to create participant');
    err.status = response.status;
    err.code = code;
    throw err;
  }

  return response.json();
}
