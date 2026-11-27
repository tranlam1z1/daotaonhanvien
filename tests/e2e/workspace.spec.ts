import { expect, test, type Page } from '@playwright/test';

const seedPassword = process.env.SEED_PASSWORD ?? 'EduCore36Local!';
const seedAccounts = [
  [
    'qtnt@educore36.local',
    ['Doanh nghiệp và gói', 'Đăng ký pilot', 'Báo cáo nền tảng', 'Bộ mẫu'],
  ],
  [
    'adm@demo-a.example',
    [
      'Tổ chức',
      'Nhân viên',
      'Kho tri thức',
      'Quản lý nội dung',
      'Đào tạo',
      'Phê duyệt nội dung',
      'Bộ mẫu',
      'Phân bổ đào tạo',
      'Kiểm tra và khảo sát',
      'Việc học của tôi',
      'Xác nhận thực hành',
      'Báo cáo đào tạo',
      'Bàn giao',
    ],
  ],
  [
    'ptdt@demo-a.example',
    [
      'Tổ chức',
      'Kho tri thức',
      'Quản lý nội dung',
      'Đào tạo',
      'Bộ mẫu',
      'Phân bổ đào tạo',
      'Kiểm tra và khảo sát',
      'Việc học của tôi',
      'Báo cáo đào tạo',
      'Bàn giao',
    ],
  ],
  [
    'pd@demo-a.example',
    [
      'Tổ chức',
      'Kho tri thức',
      'Phê duyệt nội dung',
      'Việc học của tôi',
      'Bàn giao',
    ],
  ],
  [
    'nv1@demo-a.example',
    [
      'Tổ chức',
      'Kho tri thức',
      'Việc học của tôi',
      'Xác nhận thực hành',
      'Báo cáo đào tạo',
      'Bàn giao',
    ],
  ],
  ['nv2@demo-a.example', ['Kho tri thức', 'Việc học của tôi', 'Bàn giao']],
] as const;

async function signIn(page: Page, email: string, password = seedPassword) {
  await page.goto('/dang-nhap');
  await page.getByLabel('Email hoặc số điện thoại').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
}

test.describe('T06 / S01 / NFR-12', () => {
  test.skip(
    process.env.WORKSPACE_E2E !== 'true',
    'Requires a seeded test database',
  );
  test.use({ viewport: { width: 360, height: 800 } });

  for (const [email, links] of seedAccounts) {
    test(`shows the permitted navigation at 360px for ${email}`, async ({
      page,
    }) => {
      await signIn(page, email);
      const tenantName = email.includes('@demo-a')
        ? 'Doanh nghiệp demo-a'
        : 'Nền tảng EduCore36';
      await expect(page.getByRole('banner')).toContainText(tenantName);
      const menu = page.getByRole('button', { name: 'Menu' });
      const sidebar = page.getByRole('navigation', {
        name: 'Điều hướng ứng dụng',
      });
      await expect(sidebar).toBeHidden();
      await menu.click();
      await expect(sidebar.getByRole('link')).toHaveText([
        'Tổng quan',
        ...links,
      ]);
      await sidebar.getByRole('link', { name: links[0], exact: true }).click();
      await expect(sidebar).toBeHidden();
      await expect(page.getByRole('heading', { name: links[0] })).toBeVisible();

      await page.getByRole('button', { name: 'Thông báo' }).click();
      await expect(page.getByRole('dialog')).toContainText('Chưa có thông báo');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();

      await page
        .getByRole('banner')
        .getByText('Tài khoản', { exact: true })
        .click();
      await page
        .getByRole('link', { name: 'Hồ sơ cá nhân', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Hồ sơ cá nhân' }),
      ).toBeVisible();
      await expect(page.getByText(email, { exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(360);
    });
  }

  test('redirects guests and hides a restricted section from employees', async ({
    page,
  }) => {
    await page.goto('/ung-dung/ho-so');
    await expect(page).toHaveURL(/\/dang-nhap$/);
    await signIn(page, 'nv2@demo-a.example');
    await page.goto('/ung-dung/nhan-vien');
    await expect(page.getByText('Bạn không có quyền mở mục này')).toBeVisible();
    await page
      .getByRole('banner')
      .getByText('Tài khoản', { exact: true })
      .click();
    await page.getByRole('button', { name: 'Đăng xuất mọi thiết bị' }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('FR-03.05 validates and changes the password, then requires signing in again', async ({
    page,
  }) => {
    const email = 'nv2@demo-b.example';
    const replacement = 'DoiMatKhauT06!';
    await signIn(page, email);
    await page.getByRole('link', { name: 'Xem hồ sơ cá nhân' }).click();

    const passwordSection = page.getByRole('region', { name: 'Đổi mật khẩu' });
    const change = async (
      current: string,
      next: string,
      confirmation = next,
    ) => {
      await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(current);
      await page.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
      await page
        .getByLabel('Nhập lại mật khẩu mới', { exact: true })
        .fill(confirmation);
      await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
    };
    await change(seedPassword, replacement, 'KhongTrung06!');
    await expect(passwordSection.getByRole('alert')).toHaveText(
      'Hai mật khẩu mới chưa khớp.',
    );
    await change('SaiMatKhau06!', replacement);
    await expect(passwordSection.getByRole('alert')).toHaveText(
      'Mật khẩu hiện tại không đúng.',
    );
    await change(seedPassword, replacement);
    try {
      await expect(page.getByRole('status')).toHaveText(
        'Đã đổi mật khẩu. Vui lòng đăng nhập lại.',
      );
      await page.goto('/ung-dung/ho-so');
      await expect(page).toHaveURL(/\/dang-nhap$/);
    } finally {
      await signIn(page, email, replacement);
      await page.getByRole('link', { name: 'Xem hồ sơ cá nhân' }).click();
      await change(replacement, seedPassword);
      await expect(page.getByRole('status')).toHaveText(
        'Đã đổi mật khẩu. Vui lòng đăng nhập lại.',
      );
    }
  });
});
