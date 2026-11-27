import { expect, test } from '@playwright/test';

test.describe('T07 platform workspace at 360px', () => {
  test.skip(
    process.env.WORKSPACE_E2E !== 'true',
    'Requires a seeded test database',
  );
  test.use({ viewport: { width: 360, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/dang-nhap');
    await page
      .getByLabel('Email hoặc số điện thoại')
      .fill('qtnt@educore36.local');
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill(process.env.SEED_PASSWORD ?? 'EduCore36Local!');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Tổng quan' }),
    ).toBeVisible();
  });

  test('renders registration data as text and pre-fills the conversion form', async ({
    page,
  }) => {
    const lead = {
      id: '1b73b7b0-c608-492f-af8a-18d5798dd07c',
      companyName: '<strong data-pilot-company>Ví dụ</strong>',
      fullName: 'Nguyễn Văn A',
      jobTitle: 'Quản lý',
      companySize: '30-100',
      phone: '0912345678',
      status: 'NEW',
      notes: '<span data-pilot-note>Ghi chú</span>',
      assigneeId: null,
      tenantId: null,
      submittedAt: '2026-11-27T02:00:00.000Z',
    };
    await page.route('**/platform/leads?*', (route) =>
      route.fulfill({ json: { leads: [lead], staff: [] } }),
    );
    await page.route('**/platform/leads/' + lead.id, (route) =>
      route.fulfill({ json: lead }),
    );
    await page.goto('/ung-dung/dang-ky-pilot');
    await expect(
      page.getByRole('heading', { name: lead.companyName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Ghi chú: ' + lead.notes, { exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('[data-pilot-company], [data-pilot-note]'),
    ).toHaveCount(0);
    await page.getByRole('link', { name: 'Chuyển thành doanh nghiệp' }).click();
    await expect(page.getByLabel('Tên doanh nghiệp')).toHaveValue(
      lead.companyName,
    );
    await expect(page.getByLabel('Họ tên quản trị đầu tiên')).toHaveValue(
      lead.fullName,
    );
    await expect(page.getByLabel('Số điện thoại liên hệ')).toHaveValue(
      lead.phone,
    );
    await expect(page.getByLabel('Email quản trị đầu tiên')).toBeEmpty();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
  });

  test('opens company billing and saves company details through the browser', async ({
    page,
  }) => {
    await page.goto('/ung-dung/doanh-nghiep');
    const row = page
      .getByRole('row')
      .filter({ hasText: 'Doanh nghiệp demo-a' });
    await row.getByRole('button', { name: 'Chi tiết' }).click();
    await expect(
      page.getByRole('heading', { name: 'Thuê bao và thanh toán' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Sửa doanh nghiệp' }).click();
    await expect(page.getByLabel('Mã đăng nhập')).toHaveValue('demo-a');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByRole('status')).toHaveText('Đã lưu doanh nghiệp.');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
  });
});
