// Tests for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { CreateAppointmentPage } from '../../pages/CreateAppointmentPage.js';
import {
  API_BASE_URL,
  createAppointmentSuccessHandler,
  createAppointmentValidationErrorHandler
} from '../../features/create-appointment/__mocks__/createAppointmentHandlers.js';
import { renderWithQueryClient } from '../testUtils.js';
import * as clipboardUtils from '../../features/create-appointment/utils/clipboard.js';

const server = setupServer(createAppointmentSuccessHandler());

const templateOptionsFixture = [
  {
    id: 'default_weekly',
    title: '주간 기본 템플릿',
    description: '월~금, 11:30 - 13:30',
    badge: '기본 제공'
  },
  {
    id: 'weekend_brunch',
    title: '주말 브런치 템플릿',
    description: '토~일, 10:00 - 12:00',
    badge: '준비 중',
    disabled: true
  }
];

const templateFetcher = vi.fn().mockResolvedValue(templateOptionsFixture);

beforeAll(() => server.listen());
beforeEach(() => {
  templateFetcher.mockClear();
  templateFetcher.mockResolvedValue(templateOptionsFixture);
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

async function fillValidForm(user = userEvent.setup()) {
  await act(async () => {
    await user.type(screen.getByLabelText('약속 제목'), '테스트 약속');
    await user.type(screen.getByLabelText('약속 소개'), '테스트 소개 문구입니다.');
    const templateRadio = await screen.findByRole('radio', { name: /주간 기본 템플릿/ });
    await user.click(templateRadio);
  });
  return user;
}

describe('CreateAppointmentPage', () => {
  it('renders the hero copy and form controls on initial load', () => {
    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);

    expect(screen.getByRole('heading', { name: '함께 식사할 약속을 만들어보세요' })).toBeInTheDocument();
    expect(screen.getByLabelText('약속 제목')).toBeInTheDocument();
    expect(screen.getByLabelText('약속 소개')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: '시간 슬롯 템플릿 라디오 그룹' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '약속 만들기' })).toBeInTheDocument();
  });

  it('validates required fields and focuses the first error', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '약속 만들기' }));
    });

    expect(await screen.findByText('제목을 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('템플릿을 선택해주세요.')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText('약속 제목'));
  });

  it('updates the summary counter when the limit is exceeded', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);

    await act(async () => {
      await user.type(screen.getByLabelText('약속 소개'), 'a'.repeat(205));
    });

    expect(screen.getByText('5자를 초과했어요.')).toBeInTheDocument();
  });

  it('submits successfully and keeps the existing input values', async () => {
    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);
    const user = await fillValidForm(userEvent.setup());

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '약속 만들기' }));
    });

    expect(await screen.findByText('링크가 준비되었어요!')).toBeInTheDocument();
    const expectedUrl = new URL('/appointments/mock-appointment', window.location.origin).toString();
    expect(screen.getByTestId('share-url-text')).toHaveTextContent(expectedUrl);
    expect(screen.getByLabelText('약속 제목')).toHaveValue('테스트 약속');
  });

  it('hides the success panel when the user edits the form after success', async () => {
    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);
    const user = await fillValidForm(userEvent.setup());
    await act(async () => {
      await user.click(screen.getByRole('button', { name: '약속 만들기' }));
    });
    await screen.findByText('링크가 준비되었어요!');

    await act(async () => {
      await user.type(screen.getByLabelText('약속 제목'), '2');
    });

    expect(screen.getByTestId('create-success-panel')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: '약속 만들기' })).toBeEnabled();
  });

  it('displays field level errors returned by the server', async () => {
    server.use(createAppointmentValidationErrorHandler());
    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);
    const user = await fillValidForm(userEvent.setup());

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '약속 만들기' }));
    });

    expect(await screen.findByText('제목 오류')).toBeInTheDocument();
    expect(screen.getByText('템플릿 오류')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('scrolls to the success section after an appointment is created', async () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof originalScrollIntoView;

    try {
      renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);
      const user = await fillValidForm(userEvent.setup());

      await act(async () => {
        await user.click(screen.getByRole('button', { name: '약속 만들기' }));
      });

      await screen.findByText('링크가 준비되었어요!');

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it('shows a retry banner for server outages and retries on demand', async () => {
    let attempt = 0;
    server.use(
      rest.post(`${API_BASE_URL}/appointments`, async (_req, res, ctx) => {
        attempt += 1;
        if (attempt === 1) {
          return res(ctx.status(503), ctx.json({ message: 'server error' }));
        }
        return res(ctx.status(201), ctx.json({
          appointmentId: 'retry-success',
          shareUrl: '/appointments/retry-success',
          title: '약속 제목',
          summary: '설명',
          timeSlotTemplateId: 'default_weekly',
          createdAt: new Date().toISOString()
        }));
      })
    );

    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);
    const user = await fillValidForm(userEvent.setup());

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '약속 만들기' }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('일시적인 문제로 약속을 생성할 수 없습니다. 잠시 후 다시 시도하세요.');

    const retryButton = await screen.findByRole('button', { name: '다시 시도' });
    await act(async () => {
      await user.click(retryButton);
    });

    expect(await screen.findByText('링크가 준비되었어요!')).toBeInTheDocument();
  });

  it('invokes the clipboard API on success when the user copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(clipboardUtils, 'getClipboard').mockReturnValue({ writeText } as unknown as Clipboard);

    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);
    const user = await fillValidForm(userEvent.setup());

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '약속 만들기' }));
    });
    await screen.findByText('링크가 준비되었어요!');
    const copyButton = screen.getByRole('button', { name: '링크 복사하기' });
    await act(async () => {
      await user.click(copyButton);
    });

    const expectedUrl = new URL('/appointments/mock-appointment', window.location.origin).toString();
    expect(writeText).toHaveBeenCalledWith(expectedUrl);
    expect(screen.getByRole('status')).toHaveTextContent('클립보드에 복사되었습니다.');

  });

  it('shows an error banner when clipboard permissions are denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.spyOn(clipboardUtils, 'getClipboard').mockReturnValue({ writeText } as unknown as Clipboard);
    const documentWithExecCommand = document as Document & { execCommand?: (command: string) => boolean };
    documentWithExecCommand.execCommand = () => {
      throw new Error('copy failed');
    };
    vi.spyOn(documentWithExecCommand, 'execCommand');

    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);
    const user = await fillValidForm(userEvent.setup());
    await act(async () => {
      await user.click(screen.getByRole('button', { name: '약속 만들기' }));
    });
    await screen.findByText('링크가 준비되었어요!');

    const fallbackCopyButton = screen.getByRole('button', { name: '링크 복사하기' });
    await act(async () => {
      await user.click(fallbackCopyButton);
    });

    expect(await screen.findByText('링크 복사에 실패했습니다. 잠시 후 다시 시도해주세요.')).toBeInTheDocument();

  });

  it('keeps the template radio buttons accessible via keyboard', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<CreateAppointmentPage apiBaseUrl={API_BASE_URL} templateFetcher={templateFetcher} />);

    const templateGroup = screen.getByRole('radiogroup', { name: '시간 슬롯 템플릿 라디오 그룹' });
    const firstTemplate = await within(templateGroup).findByRole('radio', { name: /주간 기본 템플릿/ });

    firstTemplate.focus();
    await act(async () => {
      await user.keyboard(' ');
    });

    expect(firstTemplate).toHaveAttribute('aria-checked', 'true');
  });
});
