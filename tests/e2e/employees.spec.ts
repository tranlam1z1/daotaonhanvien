import { expect, test } from '@playwright/test';

test.describe('T09 employees at 360px', () => {
  test.skip(
    process.env.WORKSPACE_E2E !== 'true',
    'Requires a seeded test database',
  );
  test.use({ viewport: { width: 360, height: 800 } });

  test('downloads the template and manages an employee with a name containing HTML', async ({
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
    await page.goto('/ung-dung/nhan-vien');

    const dialog = page.getByRole('dialog');
    await page.getByRole('button', { name: 'Nhập Excel' }).click();
    const download = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'Tải mẫu Excel' }).click();
    expect((await download).suggestedFilename()).toBe(
      'mau-nhap-nhan-vien.xlsx',
    );
    await dialog.getByRole('button', { name: 'Đóng' }).click();

    const code = 'T09-' + Date.now();
    const name = '<strong data-test-employee>' + code + '</strong>';
    await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
    await dialog.getByLabel('Mã nhân viên').fill(code);
    await dialog.getByLabel('Họ tên').fill(name);
    await dialog
      .getByLabel('Email')
      .fill(code.toLowerCase() + '@demo-a.example');
    await dialog.getByLabel('Ngày vào làm (dd/MM/yyyy)').fill('27/11/2026');
    await dialog.getByRole('button', { name: 'Lưu nhân viên' }).click();

    const row = page.getByRole('listitem').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(page.locator('[data-test-employee]')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);

    await row.getByRole('button', { name: 'Phân quyền' }).click();
    await dialog.getByLabel('Phụ trách đào tạo', { exact: true }).check();
    await dialog
      .getByRole('checkbox', { name: 'Vận hành', exact: true })
      .check();
    await dialog.getByRole('button', { name: 'Lưu phân quyền' }).click();
    await expect(row).toContainText('Phụ trách đào tạo');

    await row.getByRole('button', { name: 'Xóa', exact: true }).click();
    await dialog.getByRole('button', { name: 'Xóa nhân viên' }).click();
    await expect(row).toHaveCount(0);
  });
});
