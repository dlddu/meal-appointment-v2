// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../../api/getAppointmentTemplate.js', () => ({
  getAppointmentTemplate: vi.fn()
}));
vi.mock('../../api/createParticipant.js', () => ({
  createParticipant: vi.fn()
}));
vi.mock('../../api/submitAvailability.js', () => ({
  submitAvailability: vi.fn()
}));

import { useParticipationFlow } from '../useParticipationFlow.js';
import { createTestQueryClient } from '../../../../tests/testUtils.js';
import { participationStrings } from '../../strings.js';
import { templateResponse } from '../../__mocks__/participationHandlers.js';
import { getAppointmentTemplate, type ParticipationApiError } from '../../api/getAppointmentTemplate.js';
import { createParticipant } from '../../api/createParticipant.js';
import { submitAvailability } from '../../api/submitAvailability.js';

const getTemplateMock = vi.mocked(getAppointmentTemplate);
const createParticipantMock = vi.mocked(createParticipant);
const submitAvailabilityMock = vi.mocked(submitAvailability);

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('useParticipationFlow', () => {
  it('hydrates template rules and summary map from the template query', async () => {
    getTemplateMock.mockResolvedValue(templateResponse);

    const { result } = renderHook(
      () => useParticipationFlow({ appointmentId: 'apt-1', apiBaseUrl: 'http://localhost/api' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.templateRules).toHaveLength(templateResponse.template.rules.length);
    expect(result.current.summaryMap['2024-05-06#LUNCH']).toEqual(templateResponse.aggregates.slotSummaries[0]);
  });

  it('toggles slots locally and resets selections', async () => {
    getTemplateMock.mockResolvedValue(templateResponse);

    const { result } = renderHook(
      () => useParticipationFlow({ appointmentId: 'apt-2', apiBaseUrl: 'http://localhost/api' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.toggleSlot('2024-05-06#LUNCH');
    });
    expect(result.current.selectedSlots).toContain('2024-05-06#LUNCH');

    act(() => {
      result.current.resetSelection();
    });
    expect(result.current.selectedSlots).toHaveLength(0);
  });

  it('surfaces validation errors when submitting without a nickname', async () => {
    getTemplateMock.mockResolvedValue(templateResponse);

    const { result } = renderHook(
      () => useParticipationFlow({ appointmentId: 'apt-3', apiBaseUrl: 'http://localhost/api' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.handleSubmitAvailability();
    });

    await waitFor(() => expect(result.current.errorState?.code).toBe('validation'));
    expect(result.current.errorState?.message).toBe(participationStrings.nicknameLabel);
  });

  it('maps server errors from the template fetch to user friendly codes', async () => {
    const error: ParticipationApiError = Object.assign(new Error('not found'), {
      code: 'APPOINTMENT_NOT_FOUND',
      status: 404
    });
    getTemplateMock.mockRejectedValue(error);

    const { result } = renderHook(
      () => useParticipationFlow({ appointmentId: 'missing', apiBaseUrl: 'http://localhost/api' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.queryError?.code).toBe('notFound'), { timeout: 5000 });
  });

  it('updates summary when availability submission succeeds', async () => {
    getTemplateMock.mockResolvedValue(templateResponse);
    createParticipantMock.mockResolvedValue({
      participantId: 'participant-1',
      hasPin: false,
      responses: ['2024-05-06#LUNCH'],
      submittedAt: '2024-05-06T08:00:00.000Z',
      nickname: '테스터'
    });
    submitAvailabilityMock.mockResolvedValue({
      participantId: 'participant-1',
      selected: ['2024-05-06#LUNCH'],
      submittedAt: '2024-05-07T10:00:00.000Z',
      summary: templateResponse.aggregates
    });

    const { result } = renderHook(
      () => useParticipationFlow({ appointmentId: 'apt-4', apiBaseUrl: 'http://localhost/api', initialNickname: '테스터' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.handleStart();
    });

    await waitFor(() => expect(result.current.participantId).toBe('participant-1'));

    await act(async () => {
      result.current.handleSubmitAvailability();
    });

    await waitFor(() => expect(result.current.lastSubmittedAt).toBe('2024-05-07T10:00:00.000Z'));
    expect(result.current.summary?.participantCount).toBe(templateResponse.aggregates.participantCount);
  });
});
