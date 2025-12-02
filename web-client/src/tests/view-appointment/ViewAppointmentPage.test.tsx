// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewAppointmentPage } from '../../pages/ViewAppointmentPage.js';
import { API_BASE_URL, buildViewAppointmentResponse } from '../../features/view-appointment/__mocks__/viewAppointmentHandlers.js';
import { renderWithQueryClient } from '../testUtils.js';
import { getAppointment, type AppointmentApiError } from '../../features/view-appointment/api/getAppointment.js';
import { viewAppointmentStrings } from '../../features/view-appointment/strings.js';

vi.mock('../../features/view-appointment/api/getAppointment.js', () => ({
  getAppointment: vi.fn()
}));

const getAppointmentMock = vi.mocked(getAppointment);

afterEach(() => {
  vi.resetAllMocks();
});

function renderPage(appointmentId = 'appointment-1') {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[`/appointments/${appointmentId}`]}>
      <Routes>
        <Route path="/appointments/:appointmentId" element={<ViewAppointmentPage apiBaseUrl={API_BASE_URL} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ViewAppointmentPage', () => {
  it('shows loading indicators on initial render', () => {
    getAppointmentMock.mockResolvedValue(buildViewAppointmentResponse());
    renderPage('loading-case');
    expect(screen.getByText(viewAppointmentStrings.loading)).toBeInTheDocument();
  });

  it('renders slot cards and participant tabs after successful fetch', async () => {
    getAppointmentMock.mockResolvedValue(buildViewAppointmentResponse());
    renderPage('success-case');

    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    expect(getAppointmentMock).toHaveBeenCalledWith('success-case', API_BASE_URL);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: '점심 약속' })).toBeInTheDocument()
    );
    expect(screen.getAllByText(/% 응답/)).toHaveLength(6);
    expect(screen.getByRole('tab', { name: '응답자 목록' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '슬롯별 상세' })).toBeInTheDocument();
  });

  it('shows an empty participant banner when no responders exist', async () => {
    getAppointmentMock.mockResolvedValue(
      buildViewAppointmentResponse({ participants: [], aggregates: { participantCount: 0, slotSummaries: [] } })
    );

    renderPage('empty-case');
    await waitFor(() => expect(screen.getByText('아직 슬롯 응답이 없습니다')).toBeInTheDocument());
    expect(screen.getByText('아직 응답이 없습니다')).toBeInTheDocument();
  });

  it('renders not found empty state without alert role for 404', async () => {
    const error = Object.assign(new Error('not found'), {
      status: 404,
      code: 'APPOINTMENT_NOT_FOUND'
    } satisfies Partial<AppointmentApiError>);
    getAppointmentMock.mockRejectedValue(error);
    renderPage('not-found');

    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('약속을 찾을 수 없습니다')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retries when temporary failures occur', async () => {
    getAppointmentMock
      .mockRejectedValueOnce(Object.assign(new Error('temporary'), { status: 503 } as AppointmentApiError))
      .mockResolvedValueOnce(buildViewAppointmentResponse());

    renderPage('retry-case');
    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    const retryButton = within(screen.getByRole('alert')).getByRole('button', {
      name: '데이터 다시 불러오기'
    });
    await userEvent.click(retryButton);

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: '점심 약속' })).toBeInTheDocument()
    );
    expect(getAppointmentMock).toHaveBeenCalledTimes(2);
  });

  it('copies the share link to the clipboard and shows a toast', async () => {
    getAppointmentMock.mockResolvedValue(buildViewAppointmentResponse());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true
    });
    const appointmentId = 'share-case';
    window.history.pushState({}, '', `/appointments/${appointmentId}`);

    renderPage(appointmentId);
    await waitFor(() => expect(getAppointmentMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: '점심 약속' })).toBeInTheDocument()
    );

    const shareButton = screen.getByRole('button', { name: '공유 링크 복사' });
    await userEvent.click(shareButton);

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/appointments/${appointmentId}`);
    expect(screen.getByRole('status')).toHaveTextContent('링크를 복사했어요');
  });
});
