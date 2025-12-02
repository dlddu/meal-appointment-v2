// Implemented for spec: agent/specs/meal-appointment-local-testing-spec.md

import { test, expect } from '@playwright/test';

const nickname = `E2E-참여자-${Date.now()}`;

const stubClipboard = () => {
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: () => Promise.resolve()
    },
    configurable: true
  });
};

test.describe('약속 생성-조회-참여 풀 플로우', () => {
  test('사용자가 약속을 만들고 상세를 확인한 뒤 참여할 수 있다', async ({ page }) => {
    const uniqueTitle = `E2E 전체 흐름 ${Date.now()}`;

    await page.addInitScript(stubClipboard);

    await page.goto('/create');
    await expect(page.getByRole('heading', { name: '함께 식사할 약속을 만들어보세요' })).toBeVisible();

    await page.getByLabel('약속 제목').fill(uniqueTitle);
    await page.getByLabel('약속 소개').fill('약속 생성부터 참여까지 이어지는 전체 흐름 테스트입니다.');
    await page.getByRole('radio', { name: '주간 기본 템플릿' }).click();
    await page.getByRole('button', { name: '약속 만들기' }).click();

    const shareLinkLocator = page.getByTestId('share-url-text');
    await expect(shareLinkLocator).toContainText('/appointments/');
    const shareUrl = (await shareLinkLocator.textContent())?.trim();
    expect(shareUrl).toBeTruthy();

    await page.goto(shareUrl!);
    await expect(page.getByRole('heading', { name: '약속 개요' })).toBeVisible();
    await expect(page.getByText('슬롯 현황', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '응답 작성하기' }).click();

    await expect(page).toHaveURL(/\/appointments\/.*\/participate/);
    await expect(page.getByRole('heading', { name: '가용 시간 제출' })).toBeVisible();

    await page.getByLabel('닉네임').fill(nickname);
    await page.getByRole('button', { name: '참여 시작' }).click();

    const slots = page.getByTestId(/^slot-/);
    await expect(slots.first()).toBeVisible();
    await slots.nth(0).click();
    await slots.nth(1).click();

    await page.getByRole('button', { name: '가용 시간 제출' }).click();
    await expect(page.getByRole('status').filter({ hasText: '가용 시간을 제출했어요' })).toBeVisible();
  });
});
