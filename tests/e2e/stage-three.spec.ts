import { expect, test } from '@playwright/test';

test.describe('Giai đoạn 3 ở 360px', () => {
  test.skip(
    process.env.WORKSPACE_E2E !== 'true',
    'Requires a seeded test database',
  );
  test.use({ viewport: { width: 360, height: 800 } });

  test('opens handover, exports a report, and displays notification preferences', async ({
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

    await page.goto('/ung-dung/ban-giao');
    await expect(
      page.getByRole('heading', { name: 'Đánh dấu nghỉ việc' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Tạo hồ sơ bàn giao' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);

    await page.goto('/ung-dung/bao-cao-dao-tao');
    await expect(
      page.getByRole('heading', { name: 'Chi tiết lượt học' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Xuất Excel' }).click();
    expect((await download).suggestedFilename()).toBe('bao-cao-dao-tao.xlsx');

    await page.getByRole('button', { name: 'Thông báo' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Tùy chọn email', { exact: true }).click();
    await expect(
      dialog.getByRole('checkbox', { name: 'Đào tạo' }),
    ).toBeVisible();
    await expect(
      dialog.getByText('Email bàn giao và quá hạn luôn được gửi.'),
    ).toBeVisible();
  });
});
