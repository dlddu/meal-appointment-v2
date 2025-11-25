// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { WeekNavigator } from '../components/WeekNavigator.js';

const baseDate = new Date('2024-05-08T00:00:00Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('WeekNavigator', () => {
  it('renders the current week range and triggers callbacks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });

    const onChange = vi.fn();
    render(<WeekNavigator weekOffset={0} onChange={onChange} />);

    expect(screen.getByText('2024-05-06 ~ 2024-05-12')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음 주' }));
    await user.click(screen.getByRole('button', { name: '이전 주' }));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).toHaveBeenCalledWith(-1);
  });
});
