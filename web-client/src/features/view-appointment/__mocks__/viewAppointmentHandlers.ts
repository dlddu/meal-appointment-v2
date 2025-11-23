// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { rest } from 'msw';
import type { AppointmentViewResponse } from '../api/getAppointment.js';

export const API_BASE_URL = 'http://localhost/api';

const baseResponse: AppointmentViewResponse = {
  appointment: {
    id: 'appointment-1',
    title: '점심 약속',
    summary: '점심 시간 확인',
    createdAt: '2024-05-01T09:00:00.000Z',
    updatedAt: '2024-05-02T12:00:00.000Z',
    timeSlotTemplateId: 'template-1'
  },
  template: {
    id: 'template-1',
    name: '주간 템플릿',
    description: '기본 슬롯',
    rules: [{ dayPattern: 'WEEKDAY', mealTypes: ['LUNCH'] }]
  },
  participants: [
    {
      participantId: 'p1',
      nickname: '알파',
      submittedAt: '2024-05-02T10:00:00.000Z',
      responses: ['2024-05-03#LUNCH', '2024-05-04#LUNCH']
    },
    {
      participantId: 'p2',
      nickname: '베타',
      submittedAt: '2024-05-02T11:00:00.000Z',
      responses: ['2024-05-03#LUNCH']
    }
  ],
  aggregates: {
    participantCount: 2,
    slotSummaries: [
      {
        slotKey: '2024-05-03#LUNCH',
        date: '2024-05-03',
        mealType: 'LUNCH',
        availableCount: 2,
        availabilityRatio: 1
      },
      {
        slotKey: '2024-05-04#LUNCH',
        date: '2024-05-04',
        mealType: 'LUNCH',
        availableCount: 1,
        availabilityRatio: 0.5
      },
      {
        slotKey: '2024-05-05#LUNCH',
        date: '2024-05-05',
        mealType: 'LUNCH',
        availableCount: 0,
        availabilityRatio: 0.2
      }
    ]
  }
};

export function buildViewAppointmentResponse(
  overrides: Partial<AppointmentViewResponse> = {}
): AppointmentViewResponse {
  return {
    ...baseResponse,
    ...overrides,
    appointment: { ...baseResponse.appointment, ...overrides.appointment },
    template: { ...baseResponse.template, ...overrides.template },
    participants: overrides.participants ?? baseResponse.participants,
    aggregates: {
      ...baseResponse.aggregates,
      ...overrides.aggregates,
      slotSummaries: overrides.aggregates?.slotSummaries ?? baseResponse.aggregates.slotSummaries
    }
  };
}

export function viewAppointmentSuccessHandler(
  response: AppointmentViewResponse = baseResponse
) {
  return rest.get('*/appointments/:id', async (_req, res, ctx) => res(ctx.status(200), ctx.json(response)));
}

export function viewAppointmentNotFoundHandler() {
  return rest.get('*/appointments/:id', async (_req, res, ctx) =>
    res(ctx.status(404), ctx.json({ error: { code: 'APPOINTMENT_NOT_FOUND' } }))
  );
}

export function viewAppointmentTemporaryFailureHandler() {
  return rest.get('*/appointments/:id', async (_req, res, ctx) => res(ctx.status(503), ctx.json({})));
}

export function viewAppointmentNetworkErrorHandler() {
  return rest.get('*/appointments/:id', async (_req, res, ctx) => ctx.networkError('offline'));
}
