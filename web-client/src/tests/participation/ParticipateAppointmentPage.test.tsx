// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipateAppointmentPage } from '../../pages/ParticipateAppointmentPage.js';
import { participationStrings } from '../../features/participation/strings.js';
import type { ParticipationError } from '../../features/participation/hooks/useParticipationFlow.js';
import { renderWithQueryClient } from '../testUtils.js';

const mockUseParticipationFlow = vi.hoisted(() => vi.fn());

vi.mock('../../features/participation/hooks/useParticipationFlow.js', () => ({
  useParticipationFlow: (...args: unknown[]) => mockUseParticipationFlow(...args)
}));

afterEach(() => {
  vi.clearAllMocks();
});

function renderPage() {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[`/appointments/apt-1/participate`]}> 
      <Routes>
        <Route path="/appointments/:appointmentId/participate" element={<ParticipateAppointmentPage apiBaseUrl="/api" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ParticipateAppointmentPage', () => {
  it('shows loading skeleton when query is pending', () => {
    mockUseParticipationFlow.mockReturnValue({
      nickname: '',
      pin: '',
      setNickname: vi.fn(),
      setPin: vi.fn(),
      setIsPersistedLocally: vi.fn(),
      isPersistedLocally: false,
      participantId: null,
      lastSubmittedAt: null,
      summary: null,
      templateRules: [],
      selectedSlots: [],
      summaryMap: {},
      participantCount: 0,
      toggleSlot: vi.fn(),
      resetSelection: vi.fn(),
      handleStart: vi.fn(),
      handleSubmitAvailability: vi.fn(),
      isLoading: true,
      isError: false,
      queryError: null,
      refetch: vi.fn(),
      toasts: [],
      dismissToast: vi.fn(),
      isCreating: false,
      isSubmitting: false,
      errorState: null
    });

    renderPage();
    expect(screen.getAllByText(participationStrings.loading)).toHaveLength(2);
  });

  it('renders not found state for 404 errors', async () => {
    mockUseParticipationFlow.mockReturnValue({
      nickname: '',
      pin: '',
      setNickname: vi.fn(),
      setPin: vi.fn(),
      setIsPersistedLocally: vi.fn(),
      isPersistedLocally: false,
      participantId: null,
      lastSubmittedAt: null,
      summary: null,
      templateRules: [],
      selectedSlots: [],
      summaryMap: {},
      participantCount: 0,
      toggleSlot: vi.fn(),
      resetSelection: vi.fn(),
      handleStart: vi.fn(),
      handleSubmitAvailability: vi.fn(),
      isLoading: false,
      isError: true,
      queryError: { code: 'notFound', message: participationStrings.notFound } satisfies ParticipationError,
      refetch: vi.fn(),
      toasts: [],
      dismissToast: vi.fn(),
      isCreating: false,
      isSubmitting: false,
      errorState: null
    });

    renderPage();
    expect(await screen.findByText(participationStrings.notFound)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('allows toggling help card and submitting availability when ready', async () => {
    const refetch = vi.fn();
    const handleSubmitAvailability = vi.fn();
    const dismissToast = vi.fn();

    mockUseParticipationFlow.mockReturnValue({
      nickname: '테스터',
      pin: '',
      setNickname: vi.fn(),
      setPin: vi.fn(),
      setIsPersistedLocally: vi.fn(),
      isPersistedLocally: true,
      participantId: 'participant-1',
      lastSubmittedAt: '2024-05-06T10:00:00.000Z',
      summary: { participantCount: 2, slotSummaries: [] },
      templateRules: [{ dayPattern: 'EVERYDAY', mealTypes: ['LUNCH'] }],
      selectedSlots: ['2024-05-06#LUNCH'],
      summaryMap: {},
      participantCount: 2,
      toggleSlot: vi.fn(),
      resetSelection: vi.fn(),
      handleStart: vi.fn(),
      handleSubmitAvailability,
      isLoading: false,
      isError: false,
      queryError: null,
      refetch,
      toasts: [{ id: 'toast-1', message: '성공', variant: 'success' }],
      dismissToast,
      isCreating: false,
      isSubmitting: false,
      errorState: null
    });

    renderPage();
    await userEvent.click(screen.getByRole('button', { name: participationStrings.helpCta }));
    expect(await screen.findByText(participationStrings.helpTitle)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: participationStrings.submitAvailability }));
    expect(handleSubmitAvailability).toHaveBeenCalled();
    expect(screen.getByText('성공')).toBeInTheDocument();
  });
});
