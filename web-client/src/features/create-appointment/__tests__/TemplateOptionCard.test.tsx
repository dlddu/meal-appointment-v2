// Tests for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TemplateOptionCard } from '../components/TemplateOptionCard.js';

const baseOption = {
  id: 'default_weekly',
  title: '주간 기본 템플릿',
  description: '월~금, 11:30 - 13:30'
};

describe('TemplateOptionCard', () => {
  it('toggles selection with Enter and Space keys', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleUnavailable = vi.fn();
    const { rerender } = render(
      <TemplateOptionCard
        option={baseOption}
        selected={false}
        onSelect={handleSelect}
        onUnavailable={handleUnavailable}
      />
    );

    const card = screen.getByRole('radio', { name: /주간 기본 템플릿/ });
    expect(card).toHaveAttribute('aria-checked', 'false');

    card.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(handleSelect).toHaveBeenCalledTimes(2);

    rerender(
      <TemplateOptionCard
        option={baseOption}
        selected={true}
        onSelect={handleSelect}
        onUnavailable={handleUnavailable}
      />
    );

    expect(screen.getByRole('radio', { name: /주간 기본 템플릿/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('notifies unavailable state when disabled template is clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const handleUnavailable = vi.fn();

    render(
      <TemplateOptionCard
        option={{ ...baseOption, id: 'weekend_brunch', title: '주말 브런치 템플릿', disabled: true }}
        selected={false}
        onSelect={handleSelect}
        onUnavailable={handleUnavailable}
      />
    );

    const card = screen.getByRole('radio', { name: /주말 브런치 템플릿/ });
    await user.click(card);

    expect(handleUnavailable).toHaveBeenCalledTimes(1);
    expect(handleSelect).not.toHaveBeenCalled();
    expect(card).toHaveAttribute('aria-disabled', 'true');
  });
});
