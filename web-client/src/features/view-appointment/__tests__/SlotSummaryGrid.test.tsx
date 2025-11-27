// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SlotSummaryGrid } from '../components/SlotSummaryGrid.js';
import type { SlotGroup } from '../utils/groupSlotSummaries.js';

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

  it('shows an empty message and retry button when there are no slot groups', () => {
    const onRetry = vi.fn();
    render(<SlotSummaryGrid slotGroups={[]} participantCount={0} onRetry={onRetry} />);

    expect(screen.getByText('아직 슬롯 응답이 없습니다')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: '재시도' });
    retryButton.click();
    expect(onRetry).toHaveBeenCalled();
  });
});
