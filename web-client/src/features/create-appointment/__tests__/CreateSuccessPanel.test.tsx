// Tests for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { CreateSuccessPanel } from '../components/CreateSuccessPanel.js';
import type { CreateAppointmentResult } from '../types.js';
import * as clipboardUtils from '../utils/clipboard.js';

const baseResult: CreateAppointmentResult = {
  payload: {
    title: '점심 약속',
    summary: '설명',
    timeSlotTemplateId: 'default_weekly'
  },
  response: {
    appointmentId: 'abc123',
    shareUrl: '/appointments/abc123',
    title: '점심 약속',
    summary: '설명',
    timeSlotTemplateId: 'default_weekly',
    createdAt: new Date().toISOString()
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateSuccessPanel', () => {
  it('shows the absolute share URL and copy button label', () => {
    render(<CreateSuccessPanel result={baseResult} onCopyError={() => {}} />);

    const expectedUrl = new URL(baseResult.response.shareUrl, window.location.origin).toString();
    expect(screen.getByTestId('share-url-text')).toHaveTextContent(expectedUrl);
    expect(screen.getByRole('button', { name: '링크 복사하기' })).toBeInTheDocument();
  });

  it('falls back to execCommand and reports copy errors', async () => {
    const user = userEvent.setup();
    const onCopyError = vi.fn();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.spyOn(clipboardUtils, 'getClipboard').mockReturnValue({ writeText } as unknown as Clipboard);
    const documentWithExecCommand = document as Document & { execCommand?: (command: string) => boolean };
    documentWithExecCommand.execCommand = vi.fn().mockReturnValue(false);
    const execCommandSpy = vi.spyOn(documentWithExecCommand, 'execCommand');

    render(<CreateSuccessPanel result={baseResult} onCopyError={onCopyError} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '링크 복사하기' }));
    });

    const expectedUrl = new URL(baseResult.response.shareUrl, window.location.origin).toString();
    expect(writeText).toHaveBeenCalledWith(expectedUrl);
    expect(execCommandSpy).toHaveBeenCalledWith('copy');

    await waitFor(() => {
      expect(onCopyError).toHaveBeenCalledWith('링크 복사에 실패했습니다. 잠시 후 다시 시도해주세요.');
    });
  });
});
