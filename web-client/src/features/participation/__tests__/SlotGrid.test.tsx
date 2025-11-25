// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlotGrid } from '../components/SlotGrid.js';

const slots = [
  { slotKey: '2024-05-06#LUNCH', dateLabel: '2024-05-06', dayLabel: '월요일', mealType: 'LUNCH' },
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
});
