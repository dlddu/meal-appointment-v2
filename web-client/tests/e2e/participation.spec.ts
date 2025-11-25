// Implemented for spec: agent/specs/meal-appointment-participation-frontend-test-spec.md

import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = 'http://127.0.0.1:4002/api';

async function createAppointment(request: APIRequestContext) {
  const response = await request.post(`${API_BASE}/appointments`, {
    data: {
      title: `참여 E2E ${Date.now()}`,
      summary: '참여 시나리오를 위한 테스트 약속입니다.',
      timeSlotTemplateId: 'default_weekly'
    }
  });
  const body = await response.json();
  return body.appointmentId as string;
}

test.describe('식사 약속 참여', () => {
  test('닉네임 입력 후 슬롯을 제출할 수 있다', async ({ page, request }) => {
    const appointmentId = await createAppointment(request);

    await page.goto(`/appointments/${appointmentId}/participate`);

    await expect(page.getByRole('heading', { name: '가용 시간 제출' })).toBeVisible();

    await page.getByLabel('닉네임').fill('플레이ライト참여자');
    await page.getByRole('button', { name: '참여 시작' }).click();

    await expect(page.getByText('이전에 제출한 응답을 불러왔어요').first()).toBeVisible();

    const firstSlot = page.getByTestId(/^slot-/).first();
    await firstSlot.click();
    const secondSlot = page.getByTestId(/^slot-/).nth(1);
    await secondSlot.click();

    await page.getByRole('button', { name: '가용 시간 제출' }).click();

    await expect(page.getByRole('status').filter({ hasText: '가용 시간을 제출했어요' })).toBeVisible();
  });
});
