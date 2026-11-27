import { expect, test } from '@playwright/test';

test.describe('T11 knowledge drafts at 360px', () => {
  test.skip(
    process.env.WORKSPACE_E2E !== 'true' ||
      process.env.FILE_STORAGE_INTEGRATION_TEST !== 'true',
    'Requires a seeded tenant with a storage plan and a private test bucket',
  );
  test.use({ viewport: { width: 360, height: 800 } });

  test('creates taxonomy and a safe draft with an attachment, reopens it and downloads the linked file', async ({
    page,
  }) => {
    test.setTimeout(60_000);
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
    await page.goto('/ung-dung/noi-dung');
    const suffix = Date.now();
    const category = 'Cẩm nang ' + suffix;
    const tag = 'Nội bộ ' + suffix;
    await page.getByRole('button', { name: 'Danh mục và thẻ' }).click();
    await page.getByRole('button', { name: 'Thêm danh mục' }).click();
    await page.getByLabel('Tên danh mục', { exact: true }).fill(category);
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText(category, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Thêm thẻ' }).click();
    await page.getByLabel('Tên thẻ', { exact: true }).fill(tag);
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText(tag, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Bản nháp', exact: true }).click();
    await page.getByRole('button', { name: 'Soạn bản nháp' }).click();
    const title = '<strong data-unsafe-title>Quy trình ' + suffix + '</strong>';
    await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
    await page
      .getByRole('combobox', { name: 'Danh mục', exact: true })
      .selectOption({ label: category });
    await page.getByRole('checkbox', { name: tag }).check();
    await page
      .getByRole('combobox', { name: 'Phạm vi truy cập', exact: true })
      .selectOption('DEPARTMENTS');
    await page.getByRole('checkbox', { name: 'Vận hành' }).check();
    const editor = page.getByRole('textbox', { name: 'Nội dung', exact: true });
    await editor.fill('Nội dung định dạng');
    await editor.press('ControlOrMeta+a');
    await page.getByRole('button', { name: 'Đậm', exact: true }).click();
    await expect(editor.locator('b, strong')).toHaveText('Nội dung định dạng');
    await editor.press('End');
    await editor.evaluate((node) => {
      const clipboard = new DataTransfer();
      clipboard.setData(
        'text/html',
        '<img src=x onerror="window.t11Executed=1">',
      );
      clipboard.setData('text/plain', ' Văn bản dán');
      node.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(editor).toContainText('Văn bản dán');
    await expect(editor.locator('img')).toHaveCount(0);
    await page.getByLabel('Tải tệp đính kèm').setInputFiles({
      name: 'tai-lieu.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n',
      ),
    });
    await expect(page.getByText('tai-lieu.pdf', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(page.getByText('Đã lưu bản nháp.')).toBeVisible();
    const preview = page.getByRole('article');
    await expect(preview.getByRole('heading', { name: title })).toBeVisible();
    await expect(preview.locator('[data-unsafe-title], img')).toHaveCount(0);
    await expect(preview).toContainText('Theo phòng ban · Vận hành');
    await expect(preview).toContainText('Nội dung định dạng');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);

    await page.reload();
    const row = page.getByRole('listitem').filter({ hasText: title });
    await row.getByRole('button', { name: 'Xem trước' }).click();
    await expect(preview).toContainText(category);
    await expect(preview).toContainText(tag);
    const downloading = page.waitForEvent('download');
    await preview
      .getByRole('button', { name: 'Tải tệp · tai-lieu.pdf' })
      .click();
    expect((await downloading).suggestedFilename()).toBe('tai-lieu.pdf');

    await preview.getByRole('button', { name: 'Sửa bản nháp' }).click();
    await expect(editor).toContainText('Văn bản dán');
    await editor.fill('Nội dung đã cập nhật');
    await page.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(preview).toContainText('Nội dung đã cập nhật');

    const malicious = await page.request.post(
      'http://localhost:4000/knowledge/editor/drafts',
      {
        headers: { Origin: 'http://localhost:3000' },
        data: {
          title: 'Bản kiểm tra lọc ' + suffix,
          audience: 'TENANT',
          bodyHtml:
            '<p onclick="window.t11Executed=1"><strong>Giữ định dạng</strong><img src=x onerror="window.t11Executed=1"></p><script>window.t11Executed=1</script>',
        },
      },
    );
    expect(malicious.status()).toBe(201);
    await page.reload();
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Bản kiểm tra lọc ' + suffix })
      .getByRole('button', { name: 'Xem trước' })
      .click();
    await expect(preview.locator('strong')).toHaveText('Giữ định dạng');
    await expect(
      preview.locator('img, script, [onclick], [onerror]'),
    ).toHaveCount(0);
    await preview.getByRole('button', { name: 'Sửa bản nháp' }).click();
    await expect(
      editor.locator('img, script, [onclick], [onerror]'),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => Object.hasOwn(window, 't11Executed')),
    ).toBe(false);
  });
});
