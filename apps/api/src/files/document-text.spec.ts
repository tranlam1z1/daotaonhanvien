import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { textDocx, textPdf } from '../testing/document-fixtures';
import { extractDocumentText, searchableContentTypes } from './document-text';

it.each([
  [textPdf, searchableContentTypes[0], 'pdf search 90%_ ready'],
  [textDocx, searchableContentTypes[2], 'cẩm nang đào tạo'],
  [Buffer.from('%PDF-1.4\n%%EOF'), searchableContentTypes[0], ''],
])(
  'extracts searchable text using the document parser',
  async (bytes, contentType, expected) => {
    const directory = await mkdtemp(
      join(tmpdir(), 'educore36-extraction-test-'),
    );
    const path = join(directory, 'document');
    try {
      await writeFile(path, bytes);
      await expect(
        extractDocumentText(path, {
          contentType,
          sizeBytes: BigInt(bytes.length),
        }),
      ).resolves.toBe(expected);
    } finally {
      await rm(path, { force: true });
      await rmdir(directory);
    }
  },
);
