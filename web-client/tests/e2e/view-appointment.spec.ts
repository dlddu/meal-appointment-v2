// Implemented for spec: agent/specs/meal-appointment-view-appointment-frontend-test-spec.md

import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://127.0.0.1:4002/api';

async function createAppointment(request: APIRequestContext) {
  const response = await request.post(`${API_BASE}/appointments`, {
    data: {
      title: `Playwright 조회 테스트 ${Date.now()}`,
      summary: 'E2E 조회 시나리오를 위한 약속입니다.',
      timeSlotTemplateId: 'default_weekly'
    }
  });
  const body = await response.json();
  return body.appointmentId as string;
}

test.describe('약속 조회 플로우', () => {
  test('사용자가 공유 버튼과 응답자 탭을 확인할 수 있다', async ({ page, request }) => {
    const appointmentId = await createAppointment(request);

    const viewResponse = await request.get(`${API_BASE}/appointments/${appointmentId}`);
    expect(viewResponse.ok()).toBeTruthy();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.resolve()
        },
        configurable: true
      });
    });

    await page.goto(`/appointments/${appointmentId}`);

    await expect(page.getByRole('heading', { name: '약속 개요' })).toBeVisible();
    await expect(page.getByText('슬롯 현황')).toBeVisible();

    await page.getByRole('button', { name: '공유 링크 복사' }).click();
    await expect(page.getByRole('status')).toContainText('링크를 복사했어요');

    await page.getByRole('tab', { name: '슬롯별 상세' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });
});
