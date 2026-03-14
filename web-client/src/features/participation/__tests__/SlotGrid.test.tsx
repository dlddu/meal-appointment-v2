// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlotGrid } from '../components/SlotGrid.js';

const slots = [
  { slotKey: '2024-05-06#LUNCH', dateLabel: '2024-05-06', dayLabel: '월요일', mealType: 'LUNCH' },
  { slotKey: '2024-05-06#DINNER', dateLabel: '2024-05-06', dayLabel: '월요일', mealType: 'DINNER' },
  { slotKey: '2024-05-07#LUNCH', dateLabel: '2024-05-07', dayLabel: '화요일', mealType: 'LUNCH' },
  { slotKey: '2024-05-07#DINNER', dateLabel: '2024-05-07', dayLabel: '화요일', mealType: 'DINNER' }
];

const summaryMap = {
  '2024-05-06#LUNCH': {
    slotKey: '2024-05-06#LUNCH',
    availableCount: 4,
    availabilityRatio: 0.8,
    date: '2024-05-06',
    mealType: 'LUNCH'
  },
  '2024-05-07#DINNER': {
    slotKey: '2024-05-07#DINNER',
    availableCount: 1,
    availabilityRatio: 0.4,
    date: '2024-05-07',
    mealType: 'DINNER'
  }
};

describe('SlotGrid', () => {
  it('toggles slots when selection is allowed', async () => {
    const onToggleSlot = vi.fn();
    render(
      <SlotGrid
        slots={slots}
        selectedSlots={['2024-05-06#LUNCH']}
        onToggleSlot={onToggleSlot}
        allowSelection
        summaryMap={summaryMap}
        participantCount={5}
      />
    );

    expect(screen.getByText('점심')).toBeInTheDocument();
    expect(screen.getByLabelText('2024-05-07 저녁')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('slot-2024-05-06#LUNCH'));
    expect(onToggleSlot).toHaveBeenCalledWith('2024-05-06#LUNCH');
    expect(screen.getByLabelText('4/5')).toHaveClass('text-[var(--participation-success)]');
  });

  it('disables interaction when selection is not allowed', async () => {
    const onToggleSlot = vi.fn();
    render(
      <SlotGrid
        slots={slots}
        selectedSlots={[]}
        onToggleSlot={onToggleSlot}
        allowSelection={false}
        summaryMap={summaryMap}
        participantCount={5}
      />
    );

    await userEvent.click(screen.getByTestId('slot-2024-05-07#DINNER'));
    expect(onToggleSlot).not.toHaveBeenCalled();
    expect(screen.getByTestId('slot-2024-05-07#DINNER')).toHaveClass('cursor-not-allowed');
  });

  it('renders weekly calendar table with day columns and meal rows', () => {
    render(
      <SlotGrid
        slots={slots}
        selectedSlots={[]}
        onToggleSlot={vi.fn()}
        allowSelection
        summaryMap={summaryMap}
        participantCount={5}
      />
    );

    // Check day headers
    expect(screen.getByText('월요일')).toBeInTheDocument();
    expect(screen.getByText('화요일')).toBeInTheDocument();

    // Check meal row labels
    expect(screen.getByText('점심')).toBeInTheDocument();
    expect(screen.getByText('저녁')).toBeInTheDocument();

    // Check table structure exists
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows check mark for selected slots', () => {
    render(
      <SlotGrid
        slots={slots}
        selectedSlots={['2024-05-06#LUNCH']}
        onToggleSlot={vi.fn()}
        allowSelection
        summaryMap={summaryMap}
        participantCount={5}
      />
    );

    const selectedButton = screen.getByTestId('slot-2024-05-06#LUNCH');
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
    expect(selectedButton).toHaveTextContent('✓');
  });
});
