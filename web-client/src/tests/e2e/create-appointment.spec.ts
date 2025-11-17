// Implemented for spec: agent/specs/meal-appointment-create-appointment-frontend-test-spec.md

import { test, expect } from '@playwright/test';

const uniqueTitle = `E2E 식사 약속 ${Date.now()}`;

test.describe('약속 생성 플로우', () => {
  test('사용자가 약속을 생성하고 성공 패널을 확인할 수 있다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.resolve()
        },
        configurable: true
      });
    });

    await page.goto('/create');

    await expect(page.getByRole('heading', { name: '함께 식사할 약속을 만들어보세요' })).toBeVisible();

    await page.getByLabel('약속 제목').fill(uniqueTitle);
    await page.getByLabel('약속 소개').fill('Playwright로 생성한 테스트 약속입니다.');
    await page.getByRole('radio', { name: '주간 기본 템플릿' }).click();

    await page.getByRole('button', { name: '약속 만들기' }).click();

    await expect(page.getByText('링크가 준비되었어요!')).toBeVisible();
    const shareLink = page.getByTestId('share-url-text');
    await expect(shareLink).toContainText('/appointments/');

    const copyButton = page.getByRole('button', { name: '링크 복사하기' });
    await copyButton.click();
    await expect(page.getByRole('status')).toContainText('복사되었습니다');
  });
});
