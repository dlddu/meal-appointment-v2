// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlotSummaryGrid } from '../components/SlotSummaryGrid.js';
import type { SlotGroup } from '../utils/groupSlotSummaries.js';

const multiDateSlotGroups: SlotGroup[] = [
  {
    date: '2024-05-01',
    displayDate: '5월 1일',
    weekdayLabel: '수',
    summaries: [
      {
        slotKey: '2024-05-01#LUNCH',
        date: '2024-05-01',
        mealType: 'LUNCH',
        mealLabel: '점심',
        availableCount: 3,
        availabilityRatio: 0.8,
        ratioLabel: '80% 응답',
        ratioTone: 'primary',
        displayDate: '5월 1일',
        weekdayLabel: '수'
      }
    ]
  },
  {
    date: '2024-05-03',
    displayDate: '5월 3일',
    weekdayLabel: '금',
    summaries: [
      {
        slotKey: '2024-05-03#LUNCH',
        date: '2024-05-03',
        mealType: 'LUNCH',
        mealLabel: '점심',
        availableCount: 2,
        availabilityRatio: 0.75,
        ratioLabel: '75% 응답',
        ratioTone: 'primary',
        displayDate: '5월 3일',
        weekdayLabel: '금'
      }
    ]
  }
];

const slotGroups: SlotGroup[] = [
  {
    date: '2024-05-03',
    displayDate: '5월 3일',
    weekdayLabel: '금',
    summaries: [
      {
        slotKey: '2024-05-03#LUNCH',
        date: '2024-05-03',
        mealType: 'LUNCH',
        mealLabel: '점심',
        availableCount: 2,
        availabilityRatio: 0.75,
        ratioLabel: '75% 응답',
        ratioTone: 'primary',
        displayDate: '5월 3일',
        weekdayLabel: '금'
      },
      {
        slotKey: '2024-05-03#DINNER',
        date: '2024-05-03',
        mealType: 'DINNER',
        mealLabel: '저녁',
        availableCount: 1,
        availabilityRatio: 0.55,
        ratioLabel: '55% 응답',
        ratioTone: 'warning',
        displayDate: '5월 3일',
        weekdayLabel: '금'
      },
      {
        slotKey: '2024-05-03#BREAKFAST',
        date: '2024-05-03',
        mealType: 'BREAKFAST',
        mealLabel: '아침',
        availableCount: 0,
        availabilityRatio: 0.35,
        ratioLabel: '35% 응답',
        ratioTone: 'error',
        displayDate: '5월 3일',
        weekdayLabel: '금'
      }
    ]
  }
];

describe('SlotSummaryGrid', () => {
  it('renders tone badges for each availability ratio threshold', () => {
    render(<SlotSummaryGrid slotGroups={slotGroups} participantCount={3} />);

    const badges = screen.getAllByText(/% 응답/, { selector: 'span' });
    expect(badges[0].className).toContain('color-view-primary');
    expect(badges[1].className).toContain('color-view-warning');
    expect(badges[2].className).toContain('8A1C1C');
  });

  it('renders the date filter input', () => {
    render(<SlotSummaryGrid slotGroups={slotGroups} participantCount={3} />);
    expect(screen.getByText('이 날짜 이후만 보기')).toBeInTheDocument();
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
  });

  it('filters slot groups by the selected date', async () => {
    const user = userEvent.setup();
    render(<SlotSummaryGrid slotGroups={multiDateSlotGroups} participantCount={3} />);

    // Both dates visible initially
    expect(screen.getByText('5월 1일')).toBeInTheDocument();
    expect(screen.getByText('5월 3일')).toBeInTheDocument();

    // Set filter date to 2024-05-02 — should hide 5월 1일
    const dateInput = screen.getByDisplayValue('');
    await user.clear(dateInput);
    await user.type(dateInput, '2024-05-02');

    expect(screen.queryByText('5월 1일')).not.toBeInTheDocument();
    expect(screen.getByText('5월 3일')).toBeInTheDocument();
  });

  it('shows an empty message and retry button when there are no slot groups', () => {
    const onRetry = vi.fn();
    render(<SlotSummaryGrid slotGroups={[]} participantCount={0} onRetry={onRetry} />);

    expect(screen.getByText('아직 슬롯 응답이 없습니다')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: '재시도' });
    retryButton.click();
    expect(onRetry).toHaveBeenCalled();
  });
});
