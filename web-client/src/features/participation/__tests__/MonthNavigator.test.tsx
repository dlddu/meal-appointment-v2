import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MonthNavigator } from '../components/MonthNavigator.js';

const baseDate = new Date('2024-05-08T00:00:00Z');

afterEach(() => {
  vi.useRealTimers();
});

describe('MonthNavigator', () => {
  it('renders the current month label and triggers callbacks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });

    const onChange = vi.fn();
    render(<MonthNavigator monthOffset={0} onChange={onChange} />);

    expect(screen.getByText('2024년 5월')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다음 달' }));
    await user.click(screen.getByRole('button', { name: '이전 달' }));

    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChange).toHaveBeenCalledWith(-1);
  });

  it('shows correct month label with positive offset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);

    render(<MonthNavigator monthOffset={2} onChange={vi.fn()} />);

    expect(screen.getByText('2024년 7월')).toBeInTheDocument();
  });
});
