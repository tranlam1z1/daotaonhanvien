import { test, expect } from '@playwright/test';
test('web and API start', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeAttached();
  const response = await request.get('http://localhost:4000/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
});
