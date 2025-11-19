// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { rest } from 'msw';
import type { CreateAppointmentSuccess } from '../types.js';

export const API_BASE_URL = 'http://localhost:4000/api';

const defaultSuccess: CreateAppointmentSuccess = {
  appointmentId: 'mock-appointment',
  shareUrl: '/appointments/mock-appointment',
  title: '약속 제목',
  summary: '설명',
  timeSlotTemplateId: 'default_weekly',
  createdAt: new Date().toISOString()
};

export function createAppointmentSuccessHandler(overrides: Partial<CreateAppointmentSuccess> = {}) {
  return rest.post(`${API_BASE_URL}/appointments`, async (_req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ ...defaultSuccess, ...overrides }));
  });
}

export function createAppointmentValidationErrorHandler() {
  return rest.post(`${API_BASE_URL}/appointments`, async (_req, res, ctx) => {
    return res(
      ctx.status(400),
      ctx.json({
        errors: [
          { field: 'title', message: '제목 오류' },
          { field: 'timeSlotTemplateId', message: '템플릿 오류' }
        ]
      })
    );
  });
}

export function createAppointmentServerErrorHandler(status = 503) {
  return rest.post(`${API_BASE_URL}/appointments`, async (_req, res, ctx) => {
    return res(
      ctx.status(status),
      ctx.json({ message: '일시적인 문제로 약속을 생성할 수 없습니다. 잠시 후 다시 시도하세요.' })
    );
  });
}
