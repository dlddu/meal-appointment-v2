// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { rest } from 'msw';
import type {
  ParticipationApiError,
  ParticipationSlotSummary,
  ParticipationTemplateResponse
} from '../api/getAppointmentTemplate.js';
import type { CreateParticipantResponse } from '../api/createParticipant.js';
import type { SubmitAvailabilityResponse } from '../api/submitAvailability.js';

export const API_BASE_URL = 'http://localhost/api';

const defaultSlotSummaries: ParticipationSlotSummary[] = [
  { slotKey: '2024-05-06#LUNCH', date: '2024-05-06', mealType: 'LUNCH', availableCount: 2, availabilityRatio: 0.8 },
  { slotKey: '2024-05-07#DINNER', date: '2024-05-07', mealType: 'DINNER', availableCount: 1, availabilityRatio: 0.5 },
  { slotKey: '2024-05-08#BREAKFAST', date: '2024-05-08', mealType: 'BREAKFAST', availableCount: 0, availabilityRatio: 0.2 }
];

export const templateResponse: ParticipationTemplateResponse = {
  appointment: {
    id: 'appointment-1',
    summary: '점심 약속',
    title: '점심 식사',
    timeSlotTemplateId: 'template-1'
  },
  template: {
    id: 'template-1',
    name: '기본 템플릿',
    description: '주간 슬롯',
    rules: [
      { dayPattern: 'EVERYDAY', mealTypes: ['BREAKFAST'] },
      { dayPattern: 'WEEKDAY', mealTypes: ['LUNCH'] },
      { dayPattern: 'WEEKEND', mealTypes: ['DINNER'] }
    ]
  },
  aggregates: {
    participantCount: 3,
    slotSummaries: defaultSlotSummaries
  }
};

export const participantResponse: CreateParticipantResponse = {
  participantId: 'participant-1',
  hasPin: true,
  submittedAt: '2024-05-06T09:00:00.000Z',
  responses: ['2024-05-06#LUNCH'],
  nickname: '테스터'
};

export function buildSubmitAvailabilityResponse(
  overrides: Partial<SubmitAvailabilityResponse> = {}
): SubmitAvailabilityResponse {
  return {
    participantId: overrides.participantId ?? 'participant-1',
    selected: overrides.selected ?? ['2024-05-06#LUNCH', '2024-05-07#DINNER'],
    submittedAt: overrides.submittedAt ?? '2024-05-06T10:00:00.000Z',
    summary: {
      participantCount: overrides.summary?.participantCount ?? 3,
      slotSummaries: overrides.summary?.slotSummaries ?? defaultSlotSummaries
    }
  };
}

export function participationTemplateHandler(response: ParticipationTemplateResponse = templateResponse) {
  return rest.get('*/appointments/:id', async (_req, res, ctx) => res(ctx.status(200), ctx.json(response)));
}

export function participationCreateHandler(response: CreateParticipantResponse = participantResponse) {
  return rest.post('*/appointments/:id/participants', async (_req, res, ctx) => res(ctx.status(200), ctx.json(response)));
}

export function participationSubmitHandler(response: SubmitAvailabilityResponse = buildSubmitAvailabilityResponse()) {
  return rest.put('*/appointments/:id/participants/:participantId/responses', async (_req, res, ctx) =>
    res(ctx.status(200), ctx.json(response))
  );
}

export function participationNotFoundHandler() {
  const error: ParticipationApiError = Object.assign(new Error('not found'), {
    code: 'APPOINTMENT_NOT_FOUND',
    status: 404
  });
  return rest.get('*/appointments/:id', async (_req, res, ctx) => res(ctx.status(404), ctx.json({ error })));
}
