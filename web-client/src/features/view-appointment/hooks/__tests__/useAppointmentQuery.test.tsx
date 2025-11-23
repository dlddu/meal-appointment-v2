// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useAppointmentQuery } from '../useAppointmentQuery.js';
import { API_BASE_URL, buildViewAppointmentResponse } from '../../__mocks__/viewAppointmentHandlers.js';
import * as appointmentApi from '../../api/getAppointment.js';
import { createTestQueryClient } from '../../../../tests/testUtils.js';

vi.mock('../../api/getAppointment.js', () => ({
  getAppointment: vi.fn()
}));

const getAppointmentMock = vi.mocked(appointmentApi.getAppointment);

afterEach(() => {
  vi.resetAllMocks();
});

function mockSuccess(response = buildViewAppointmentResponse()) {
  return getAppointmentMock.mockResolvedValue(response);
}

function mockError(error: Partial<appointmentApi.AppointmentApiError>) {
  const err = Object.assign(new Error(error.message ?? 'error'), error);
  return getAppointmentMock.mockRejectedValue(err);
}

function renderUseAppointmentQuery() {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAppointmentQuery({ appointmentId: 'appointment-1', apiBaseUrl: API_BASE_URL }), {
    wrapper
  });
}

describe('useAppointmentQuery', () => {
  it('exposes loading state and empty derived data before fetch resolves', () => {
    mockSuccess();
    const { result } = renderUseAppointmentQuery();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.slotGroups).toHaveLength(0);
    expect(result.current.participantMatrix).toHaveLength(0);
  });

  it('returns derived slot groups and participant matrix on success', async () => {
    mockSuccess();
    const { result } = renderUseAppointmentQuery();

    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.slotGroups).toHaveLength(3);
    expect(result.current.slotGroups[0].summaries).toHaveLength(1);
    expect(result.current.participantMatrix[0].participants).toContain('알파');
  });

  it('maps 404 responses to a notFound error state', async () => {
    mockError({ status: 404, code: 'APPOINTMENT_NOT_FOUND' });
    const { result } = renderUseAppointmentQuery();

    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorState?.code).toBe('notFound');
  });

  it('maps 503 responses to a temporary failure state', async () => {
    mockError({ status: 503 });
    const { result } = renderUseAppointmentQuery();

    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorState?.code).toBe('temporaryFailure');
  });

  it('maps network failures to a network error state', async () => {
    mockError({ code: 'NETWORK_ERROR' });
    const { result } = renderUseAppointmentQuery();

    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorState?.code).toBe('network');
  });

  it('invokes refetch to retry the request', async () => {
    const apiSpy = vi.spyOn(appointmentApi, 'getAppointment');
    apiSpy.mockResolvedValueOnce(buildViewAppointmentResponse()).mockResolvedValueOnce(buildViewAppointmentResponse());
    const { result } = renderUseAppointmentQuery();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await result.current.refetch({ cancelRefetch: false });

    expect(apiSpy).toHaveBeenCalledTimes(2);
  });
});
