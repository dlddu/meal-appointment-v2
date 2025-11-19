// Tests for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { useCreateAppointment } from '../hooks/useCreateAppointment.js';
import type { CreateAppointmentPayload } from '../types.js';
import { createTestQueryClient } from '../../../tests/testUtils.js';
import { QueryClientProvider } from '@tanstack/react-query';

const API_BASE_URL = 'http://localhost:4000/api';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
);

const payload: CreateAppointmentPayload = {
  title: '점심 약속',
  summary: '설명',
  timeSlotTemplateId: 'default_weekly'
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCreateAppointment', () => {
  it('stores the result after a successful mutation', async () => {
    const responseBody = {
      appointmentId: 'abc123',
      shareUrl: '/appointments/abc123',
      title: payload.title,
      summary: payload.summary,
      timeSlotTemplateId: payload.timeSlotTemplateId,
      createdAt: new Date().toISOString()
    };

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }) as Response
    );

    const { result } = renderHook(() => useCreateAppointment(API_BASE_URL), { wrapper });

    result.current.submit(payload);

    await waitFor(() => {
      expect(result.current.result?.response.shareUrl).toBe('/appointments/abc123');
    });
  });

  it('maps validation errors to the fieldErrors object', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ field: 'title', message: '제목 오류' }]
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      ) as Response
    );

    const { result } = renderHook(() => useCreateAppointment(API_BASE_URL), { wrapper });

    result.current.submit(payload);

    await waitFor(() => {
      expect(result.current.fieldErrors.title).toBe('제목 오류');
    });
  });

  it('surfaces network failures as banner errors', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useCreateAppointment(API_BASE_URL), { wrapper });

    result.current.submit(payload);

    await waitFor(() => {
      expect(result.current.bannerError?.type).toBe('network');
    });
  });
});
