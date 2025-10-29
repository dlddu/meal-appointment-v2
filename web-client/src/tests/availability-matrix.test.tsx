import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvailabilityMatrix from '../components/AvailabilityMatrix';

describe('AvailabilityMatrix', () => {
  it('updates summary when slots are toggled', async () => {
    const user = userEvent.setup();
    render(<AvailabilityMatrix />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(screen.getByTestId('selection-summary').textContent).toContain('0 / 2');

    await act(async () => {
      await user.click(checkboxes[0]);
    });

    expect(screen.getByTestId('selection-summary').textContent).toContain('1 / 2');
  });
});
