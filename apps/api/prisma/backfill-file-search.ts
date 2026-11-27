import 'reflect-metadata';
import 'dotenv/config';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractDocumentText,
  searchableContentTypes,
  searchableDocumentBytes,
} from '../src/files/document-text';
import { ObjectStorage } from '../src/files/object-storage';
import { TenantDatabase } from '../src/tenant/tenant-database';

async function main() {
  const [tenantId] = process.argv.slice(2);
  if (!tenantId) {
    console.error(
      'Cách dùng: pnpm --filter @educore36/api files:backfill-search <UUID doanh nghiệp>',
    );
    process.exitCode = 1;
    return;
  }

  const directory = await mkdtemp(join(tmpdir(), 'educore36-file-search-'));
  const database = new TenantDatabase();
  const storage = new ObjectStorage();
  let lastId: string | undefined;
  let processed = 0;
  let failed = 0;
  try {
    for (;;) {
      const files = await database.run(tenantId, () =>
        database.client.fileObject.findMany({
          where: {
            tenantId,
            id: lastId ? { gt: lastId } : undefined,
            contentType: { in: searchableContentTypes },
            searchText: null,
          },
          orderBy: { id: 'asc' },
          take: 25,
          select: {
            id: true,
            storageKey: true,
            contentType: true,
            sizeBytes: true,
          },
        }),
      );
      if (!files.length) break;
      for (const file of files) {
        lastId = file.id;
        const filePath = join(directory, file.id);
        try {
          let searchText: string | null = '';
          if (file.sizeBytes <= BigInt(searchableDocumentBytes)) {
            await storage.downloadTo(
              file.storageKey,
              filePath,
              searchableDocumentBytes,
            );
            searchText = await extractDocumentText(filePath, file);
          }
          if (searchText === null) throw new Error('Extraction could not run');
          await database.run(tenantId, () =>
            database.client.fileObject.updateMany({
              where: { tenantId, id: file.id, searchText: null },
              data: { searchText },
            }),
          );
          processed++;
        } catch {
          failed++;
        } finally {
          await rm(filePath, { force: true });
        }
      }
    }
    console.log(`Đã xử lý ${processed} tệp. ${failed} tệp cần thử lại.`);
    if (failed) process.exitCode = 1;
  } finally {
    storage.onModuleDestroy();
    await database.onModuleDestroy();
    await rmdir(directory);
  }
}

void main().catch(() => {
  console.error(
    'Không thể lập chỉ mục. Kiểm tra UUID doanh nghiệp và cấu hình cơ sở dữ liệu, lưu trữ.',
  );
  process.exitCode = 1;
});
