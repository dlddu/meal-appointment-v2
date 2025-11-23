// Tests for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusMessage } from '../components/StatusMessage.js';

describe('StatusMessage', () => {
  it('announces loading state with skeleton placeholders', () => {
    render(<StatusMessage variant="loading" label="불러오는 중" />);
    expect(screen.getByText('불러오는 중')).toBeInTheDocument();
  });

  it('renders an error banner with retry', () => {
    const onRetry = vi.fn();
    render(<StatusMessage variant="error" label="오류 발생" onRetry={onRetry} />);

    screen.getByRole('button', { name: '데이터 다시 불러오기' }).click();
    expect(screen.getByRole('alert')).toHaveTextContent('오류 발생');
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows empty state with optional action', () => {
    const onRetry = vi.fn();
    render(<StatusMessage variant="empty" label="응답자가 없습니다" actionLabel="재시도" onRetry={onRetry} />);
    screen.getByRole('button', { name: '재시도' }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
