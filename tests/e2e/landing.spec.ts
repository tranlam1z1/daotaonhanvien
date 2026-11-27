import { expect, test, type Page } from '@playwright/test';

async function fillRegistration(page: Page, name = 'Nguyễn Văn An') {
  await page.getByLabel('Họ tên người liên hệ').fill(name);
  await page.getByLabel('Chức vụ', { exact: false }).fill('Giám đốc');
  await page.getByLabel('Tên doanh nghiệp').fill('Công ty Thanh Hóa');
  await page.getByLabel('Quy mô nhân sự').selectOption('30-100');
  await page.getByLabel('Số điện thoại / Zalo').fill('0912 345 678');
}

for (const width of [360, 768, 1280]) {
  test(`landing interactions and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Đừng để chất xám',
    );
    await expect(page.locator('a[href="/dang-nhap"]').first()).toHaveAttribute(
      'href',
      '/dang-nhap',
    );
    if (width < 1280) {
      const menu = page.locator('#mobile-menu-btn');
      await expect(menu).toHaveAccessibleName('Mở menu điều hướng');
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await page.locator('#mobile-menu a[href="#ba-tru-cot"]').click();
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#mobile-menu')).toBeHidden();
    }
    for (const role of ['manager', 'employee', 'admin']) {
      await page.locator(`#tab-${role}`).click();
      await expect(page.locator(`#tab-${role}`)).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.locator(`#panel-${role}`)).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.locator('#tab-admin').press('ArrowRight');
    await expect(page.locator('#tab-manager')).toBeFocused();
    await expect(page.locator('#panel-manager')).toBeVisible();
    const faq = page.locator('#faq-question-1');
    await faq.click();
    await expect(faq).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#faq-answer-1')).toBeVisible();
    await expect(page.locator('#faq-answer-0')).toBeHidden();
    await faq.click();
    await expect(page.locator('#faq-answer-1')).toBeHidden();
    await page.locator('#tab-admin').click();
    await page.locator('#faq-question-0').click();
    for (const section of await page.locator('.landing-page > section').all()) {
      await section.scrollIntoViewIfNeeded();
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({ path: `test-results/t01-hero-${width}.png` });
    await page.screenshot({
      path: `test-results/t01-${width}.png`,
      fullPage: true,
      // Render every offscreen section only while taking the full-page artifact.
      style:
        '.landing-page > section { content-visibility: visible !important; contain-intrinsic-size: none !important; }',
    });
  });
}

test('requires consent, preserves values on failure, and reports HTTP/network errors', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/public/leads', async (route) => {
    requests++;
    await route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.goto('/');
  await fillRegistration(page);
  await page
    .getByRole('button', { name: 'Gửi đăng ký tham gia Pilot ngay' })
    .click();
  await expect(page.locator('#form-error-msg')).toContainText('đồng ý');
  expect(requests).toBe(0);
  await page.getByLabel('Tôi đồng ý cho phép xử lý dữ liệu cá nhân').check();
  await page
    .getByRole('button', { name: 'Gửi đăng ký tham gia Pilot ngay' })
    .click();
  await expect(page.locator('#form-error-msg')).toContainText(
    'Chưa thể gửi đăng ký',
  );
  await expect(page.getByLabel('Họ tên người liên hệ')).toHaveValue(
    'Nguyễn Văn An',
  );
  await expect(
    page.getByRole('heading', { name: 'Đăng ký thành công!' }),
  ).toHaveCount(0);
  await page.route('**/api/public/leads', (route) => route.abort('failed'));
  await page
    .getByRole('button', { name: 'Gửi đăng ký tham gia Pilot ngay' })
    .click();
  await expect(page.locator('#form-error-msg')).toContainText(
    'vui lòng thử lại',
  );
});

test('AC-17: success renders HTML payload as text, prevents duplicate submission and resets', async ({
  page,
}) => {
  const payload = '<img src=x onerror="window.__xss=1">';
  let requests = 0;
  await page.route('**/api/public/leads', async (route) => {
    requests++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject({
      fullName: payload,
      jobTitle: 'Giám đốc',
      companyName: 'Công ty Thanh Hóa',
      companySize: '30-100',
      phone: '0912 345 678',
      consent: true,
      website: '',
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto('/');
  await fillRegistration(page, payload);
  await page.getByLabel('Tôi đồng ý cho phép xử lý dữ liệu cá nhân').check();
  await expect(page.locator('#website')).toBeHidden();
  await page
    .getByRole('button', { name: 'Gửi đăng ký tham gia Pilot ngay' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Đang gửi đăng ký…' }),
  ).toBeDisabled();
  await expect(page.getByRole('status')).toContainText(payload);
  expect(requests).toBe(1);
  await expect(page.locator('#success-summary img')).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, '__xss')),
  ).toBeUndefined();
  await page
    .getByRole('button', { name: 'Đăng ký thêm doanh nghiệp khác' })
    .click();
  await expect(page.getByLabel('Họ tên người liên hệ')).toHaveValue('');
  await expect(
    page.getByLabel('Tôi đồng ý cho phép xử lý dữ liệu cá nhân'),
  ).not.toBeChecked();
});

test('SEO metadata, crawler files and privacy placeholder', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/EduCore Thanh Hóa/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Thanh Hóa/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    /EduCore/,
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /opengraph-image/,
  );
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Sitemap:');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('/chinh-sach-bao-mat');
  const image = await request.get('/opengraph-image.png');
  expect(image.ok()).toBe(true);
  expect(image.headers()['content-type']).toContain('image/png');
  await page
    .getByRole('link', { name: 'Chính sách bảo mật', exact: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Chính sách bảo mật',
  );
  await expect(
    page.getByText('Bản khung đang được hoàn thiện', { exact: false }),
  ).toBeVisible();
});
