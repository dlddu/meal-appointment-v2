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
      }
    ]
  }
];

describe('SlotSummaryGrid', () => {
  it('renders monthly calendar with tone badges for each availability ratio threshold', () => {
    render(<SlotSummaryGrid slotGroups={slotGroups} />);

    const badges = screen.getAllByText(/% 응답/, { selector: 'span' });
    expect(badges[0].className).toContain('color-view-primary');
    expect(badges[1].className).toContain('color-view-warning');
  });

  it('renders meal row labels (점심, 저녁)', () => {
    render(<SlotSummaryGrid slotGroups={slotGroups} />);

    expect(screen.getAllByText('점심').length).toBeGreaterThan(0);
    expect(screen.getAllByText('저녁').length).toBeGreaterThan(0);
  });

  it('renders day-of-week column headers', () => {
    render(<SlotSummaryGrid slotGroups={slotGroups} />);

    expect(screen.getByText('월')).toBeInTheDocument();
    expect(screen.getByText('금')).toBeInTheDocument();
    expect(screen.getByText('일')).toBeInTheDocument();
  });

  it('renders month label', () => {
    render(<SlotSummaryGrid slotGroups={slotGroups} />);

    expect(screen.getByText('2024년 5월')).toBeInTheDocument();
  });

  it('shows an empty message and retry button when there are no slot groups', () => {
    const onRetry = vi.fn();
    render(<SlotSummaryGrid slotGroups={[]} onRetry={onRetry} />);

    expect(screen.getByText('아직 슬롯 응답이 없습니다')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: '재시도' });
    retryButton.click();
    expect(onRetry).toHaveBeenCalled();
  });
});
