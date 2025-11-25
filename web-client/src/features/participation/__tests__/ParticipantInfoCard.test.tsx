// Tests for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ParticipantInfoCard, type ParticipantCardProps } from '../components/ParticipantInfoCard.js';

function setup(props: Partial<ParticipantCardProps> = {}) {
  const onChangeNickname = vi.fn();
  const onChangePin = vi.fn();
  const onTogglePersist = vi.fn();
  const onStart = vi.fn();
  render(
    <ParticipantInfoCard
      nickname=""
      pin=""
      onChangeNickname={onChangeNickname}
      onChangePin={onChangePin}
      onTogglePersist={onTogglePersist}
      isPersistedLocally={false}
      statusBadge={{ variant: 'success', label: '불러옴', caption: '방금 전' }}
      onStart={onStart}
      isBusy={false}
      errorMessage={props.errorMessage}
      {...props}
    />
  );
  return { onChangeNickname, onChangePin, onTogglePersist, onStart };
}

describe('ParticipantInfoCard', () => {
  it('renders labels, badge, and wiring for nickname and pin inputs', async () => {
    const { onChangeNickname, onChangePin, onTogglePersist, onStart } = setup();

    await userEvent.type(screen.getByLabelText('닉네임'), '하나');
    await userEvent.type(screen.getByLabelText('PIN(선택)'), '1234');
    await userEvent.click(screen.getByLabelText('현재 기기 저장'));
    await userEvent.click(screen.getByRole('button', { name: '참여 시작' }));

    expect(onChangeNickname).toHaveBeenCalled();
    expect(onChangePin).toHaveBeenCalled();
    expect(onTogglePersist).toHaveBeenCalledWith(true);
    expect(onStart).toHaveBeenCalled();
    expect(screen.getByText('불러옴')).toBeInTheDocument();
  });

  it('surfaces validation errors inline', () => {
    setup({ errorMessage: '닉네임을 입력하세요' });
    expect(screen.getByRole('alert')).toHaveTextContent('닉네임을 입력하세요');
  });
});
