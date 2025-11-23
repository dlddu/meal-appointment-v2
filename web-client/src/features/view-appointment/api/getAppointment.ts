// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-spec.md

export type SlotSummary = {
  slotKey: string;
  date: string;
  mealType: string;
  availableCount: number;
  availabilityRatio: number;
};

export type AppointmentViewResponse = {
  appointment: {
    id: string;
    title: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
    timeSlotTemplateId: string;
  };
  template: {
    id: string;
    name: string;
    description: string;
    rules: Array<{ dayPattern: string; mealTypes: string[] }>;
  };
  participants: Array<{
    participantId: string;
    nickname: string;
    submittedAt: string;
    responses: string[];
  }>;
  aggregates: {
    participantCount: number;
    slotSummaries: SlotSummary[];
  };
};

export type AppointmentApiError = Error & {
  status?: number;
  code?: string;
};

export async function getAppointment(
  appointmentId: string,
  apiBaseUrl: string
): Promise<AppointmentViewResponse> {
  const normalizedBase = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(`appointments/${appointmentId}`, normalizedBase);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const err: AppointmentApiError = new Error('Network error');
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
    const err: AppointmentApiError = new Error('Failed to fetch appointment');
    err.status = response.status;
    err.code = code;
    throw err;
  }

  return response.json();
}
