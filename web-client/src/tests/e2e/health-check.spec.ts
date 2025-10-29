import { test, expect } from '@playwright/test';

test('API health endpoint responds with ok status', async ({ request }) => {
  const apiResponse = await request.get('http://127.0.0.1:4002/api/health');
  expect(apiResponse.ok()).toBeTruthy();
  const json = await apiResponse.json();
  expect(json.status).toBe('ok');
});

test('frontend shell renders the coordinator heading', async ({ request }) => {
  const webResponse = await request.get('/');
  expect(webResponse.ok()).toBeTruthy();
  const html = await webResponse.text();
  expect(html).toContain('Meal Appointment Coordinator');
});
