import { expect, test, type Locator, type Page } from '@playwright/test';

async function drag(page: Page, source: Locator, target: Locator) {
  await source.hover();
  await page.mouse.down();
  try {
    await target.hover();
    await target.hover();
  } finally {
    await page.mouse.up();
  }
}

test.describe('T14 training builder', () => {
  test.use({ viewport: { width: 1280, height: 1400 } });
  test.skip(
    process.env.WORKSPACE_E2E !== 'true',
    'Requires a seeded PostgreSQL test database',
  );

  test('persists drag and drop and renders user content safely at 360px', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const marker = Date.now().toString();
    const payload = '<img data-t14 src=x onerror="window.t14Executed=true">';
    const courseName = marker + ' ' + payload;

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
    await page.getByRole('link', { name: 'Đào tạo', exact: true }).click();
    await page
      .getByRole('button', { name: 'Tạo khóa học', exact: true })
      .click();
    await page.getByLabel('Tên khóa học').fill(courseName);

    const modules = page.getByRole('list', { name: 'Danh sách module' });
    const moduleRows = modules.locator(':scope > li');
    for (const [index, name] of ['Một', 'Hai'].entries()) {
      await page.getByRole('button', { name: 'Thêm module' }).click();
      await moduleRows.nth(index).getByLabel('Tên module').fill(name);
    }
    const firstModule = moduleRows.nth(0);
    for (const [index, name] of ['Mở đầu', 'Kết thúc'].entries()) {
      await firstModule.getByRole('button', { name: 'Thêm bài học' }).click();
      const row = firstModule
        .getByRole('list', { name: 'Danh sách bài học' })
        .locator(':scope > li')
        .nth(index);
      await row.getByLabel('Tên bài học').fill(name);
      await row.getByLabel('Văn bản bài học').fill(payload);
    }
    await drag(
      page,
      firstModule.getByLabel('Kéo Mở đầu', { exact: true }),
      firstModule.getByLabel('Kéo Kết thúc', { exact: true }),
    );
    await expect(firstModule.getByLabel('Tên bài học').first()).toHaveValue(
      'Kết thúc',
    );
    await drag(
      page,
      modules.getByLabel('Kéo Hai', { exact: true }),
      modules.getByLabel('Kéo Một', { exact: true }),
    );
    await expect(moduleRows.nth(0).getByLabel('Tên module')).toHaveValue('Hai');

    await page.getByRole('button', { name: 'Lưu khóa học' }).click();
    await expect(page.getByText('Đã lưu khóa học.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: courseName, exact: true }),
    ).toBeVisible();
    await expect(page.locator('[data-t14]')).toHaveCount(0);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.reload();
    const course = page.getByRole('listitem').filter({
      has: page.getByRole('heading', { name: courseName, exact: true }),
    });
    await course.getByRole('button', { name: 'Sửa khóa học' }).click();
    await expect(moduleRows.nth(0).getByLabel('Tên module')).toHaveValue('Hai');
    await expect(moduleRows.nth(1).getByLabel('Tên module')).toHaveValue('Một');
    await expect(
      moduleRows.nth(1).getByLabel('Tên bài học').first(),
    ).toHaveValue('Kết thúc');
    await expect(
      moduleRows.nth(1).getByLabel('Văn bản bài học').first(),
    ).toHaveValue(payload);
    await expect(page.locator('[data-t14]')).toHaveCount(0);
    expect(await page.evaluate(() => 't14Executed' in window)).toBe(false);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
  });
});
