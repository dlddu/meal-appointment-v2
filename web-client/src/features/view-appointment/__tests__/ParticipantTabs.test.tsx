// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ParticipantTabs } from '../components/ParticipantTabs.js';
import type { ParticipantMatrixEntry } from '../utils/buildParticipantMatrix.js';
import type { AppointmentViewResponse } from '../api/getAppointment.js';

const participants: AppointmentViewResponse['participants'] = [
  {
    participantId: 'p1',
    nickname: '알파',
    submittedAt: '2024-05-02T09:00:00.000Z',
    responses: ['2024-05-03#LUNCH']
  }
];

const participantMatrix: ParticipantMatrixEntry[] = [
  {
    slotKey: '2024-05-03#LUNCH',
    displayLabel: '5월 3일 점심',
    participants: ['알파']
  },
  {
    slotKey: '2024-05-04#DINNER',
    displayLabel: '5월 4일 저녁',
    participants: []
  }
];

describe('ParticipantTabs', () => {
  it('switches tab panels with keyboard arrows', async () => {
    const user = userEvent.setup();
    render(<ParticipantTabs participants={participants} participantMatrix={participantMatrix} />);

    const tablist = screen.getByRole('tablist');
    tablist.focus();

    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(screen.getByRole('tabpanel', { name: '슬롯별 상세' })).toBeInTheDocument();

    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(screen.getByRole('tabpanel', { name: '응답자 목록' })).toBeInTheDocument();
  });

  it('renders participant chips inside the slot matrix panel', async () => {
    const user = userEvent.setup();
    render(<ParticipantTabs participants={participants} participantMatrix={participantMatrix} />);

    await user.click(screen.getByRole('tab', { name: '슬롯별 상세' }));
    expect(screen.getByText('알파')).toBeInTheDocument();
    expect(screen.getByText('응답자가 없습니다')).toBeInTheDocument();
  });

  it('collapses participant cards by default and expands on click', async () => {
    const user = userEvent.setup();
    render(<ParticipantTabs participants={participants} participantMatrix={participantMatrix} />);

    // Default: collapsed — slot chips should not be visible
    expect(screen.queryByText('5월 3일 점심')).not.toBeInTheDocument();

    // Expand the card
    const toggleButton = screen.getByRole('button', { name: /알파/ });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Slot chip should now be visible
    expect(screen.getByText('5월 3일 점심')).toBeInTheDocument();

    // Collapse again
    await user.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('5월 3일 점심')).not.toBeInTheDocument();
  });
});
