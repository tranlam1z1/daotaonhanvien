import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('T02 AC-16/17: real form reaches API and Mailpit, rendering HTML as text', async ({
  page,
  request,
}) => {
  test.skip(
    process.env.LEAD_INTEGRATION_TEST !== 'true',
    'Requires PostgreSQL, Redis and Mailpit',
  );
  test.setTimeout(70000);
  const marker = `T02-browser-${randomUUID()}`;
  const payload = '<img src=x onerror="window.__xss=1">';
  await page.goto('/');
  await page.getByLabel('Họ tên người liên hệ').fill(payload);
  await page.getByLabel('Chức vụ', { exact: false }).fill(payload);
  await page.getByLabel('Tên doanh nghiệp').fill(marker);
  await page.getByLabel('Quy mô nhân sự').selectOption('30-100');
  await page.getByLabel('Số điện thoại / Zalo').fill('0912 345 678');
  await page.getByLabel('Tôi đồng ý cho phép xử lý dữ liệu cá nhân').check();
  const startedAt = Date.now();
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/public/leads') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Gửi đăng ký tham gia Pilot ngay' })
    .click();
  expect((await response).status()).toBe(201);
  await expect(page.getByRole('status')).toContainText(payload);
  await expect(page.locator('#success-summary img')).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, '__xss')),
  ).toBeUndefined();
  const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8025';
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${mailpit}/api/v1/search?query=${encodeURIComponent(marker)}`,
        );
        const result = await response.json();
        return result.messages.length;
      },
      { timeout: Math.max(1, 60000 - (Date.now() - startedAt)) },
    )
    .toBeGreaterThan(0);
});
