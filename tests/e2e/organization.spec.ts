import { expect, test } from '@playwright/test';

test.describe('T08 organization workspace at 360px', () => {
  test.skip(
    process.env.WORKSPACE_E2E !== 'true',
    'Requires a seeded test database',
  );
  test.use({ viewport: { width: 360, height: 800 } });

  test('saves settings, renders catalog names as text and deactivates a department', async ({
    page,
  }) => {
    await page.goto('/dang-nhap');
    await page
      .getByLabel('Email hoặc số điện thoại')
      .fill('adm@demo-a.example');
    await page
      .getByLabel('Mật khẩu', { exact: true })
      .fill(process.env.SEED_PASSWORD ?? 'EduCore36Local!');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Tổng quan' }),
    ).toBeVisible();
    await page.goto('/ung-dung/to-chuc');

    const config = page.locator('#cau-hinh');
    const reminder = config.getByLabel('Số ngày nhắc trước hạn');
    await expect(reminder).toBeVisible();
    const original = await reminder.inputValue();
    const changed = original === '5' ? '7' : '5';
    try {
      await reminder.fill(changed);
      await config.getByRole('button', { name: 'Lưu thay đổi' }).click();
      await expect(config.getByRole('status')).toHaveText('Đã lưu thay đổi.');
      await page.reload();
      await expect(reminder).toHaveValue(changed);
    } finally {
      await reminder.fill(original);
      await config.getByRole('button', { name: 'Lưu thay đổi' }).click();
      await expect(config.getByRole('status')).toHaveText('Đã lưu thay đổi.');
    }

    const departments = page.locator('#phong-ban');
    const name = '<strong data-test-organization>' + Date.now() + '</strong>';
    await departments.getByRole('button', { name: 'Thêm phòng ban' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tên phòng ban').fill(name);
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog).toBeHidden();
    await expect(departments.getByText(name, { exact: true })).toBeVisible();
    await expect(departments.locator('[data-test-organization]')).toHaveCount(
      0,
    );

    await departments
      .getByRole('button', { name: 'Sửa ' + name, exact: true })
      .click();
    await dialog.getByLabel('Trạng thái').selectOption('INACTIVE');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog).toBeHidden();
    await expect(
      departments.getByRole('listitem').filter({ hasText: name }),
    ).toContainText('Ngừng sử dụng');
    await expect(
      page.getByRole('heading', { name: 'Thông tin thuê bao' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
  });
});
