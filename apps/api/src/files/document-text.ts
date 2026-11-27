import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export const searchableContentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
export const searchableDocumentBytes = 50 * 1024 ** 2;
const maxCharacters = 200_000;
const extractionTimeoutMs = 15_000;

export function normalizeSearchText(text: string) {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Empty text means there is no indexable text. Null allows an operational retry. */
export function extractDocumentText(
  path: string,
  file: { sizeBytes: bigint; contentType: string },
): Promise<string | null> {
  if (!searchableContentTypes.includes(file.contentType))
    return Promise.resolve(null);
  if (file.sizeBytes > BigInt(searchableDocumentBytes))
    return Promise.resolve('');
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(join(__dirname, 'document-text.worker.mjs'), {
        workerData: { path, contentType: file.contentType, maxCharacters },
        resourceLimits: { maxOldGenerationSizeMb: 128 },
        stdout: true,
        stderr: true,
      });
    } catch {
      resolve(null);
      return;
    }
    worker.stdout.resume();
    worker.stderr.resume();
    let result: string | null = null;
    worker.once('message', (text: string) => {
      result = normalizeSearchText(text.replaceAll('\u0000', ''));
    });
    worker.once('error', () => {
      result = null;
    });
    const timeout = setTimeout(() => {
      void worker.terminate();
    }, extractionTimeoutMs);
    worker.once('exit', (code) => {
      clearTimeout(timeout);
      resolve(code === 0 ? result : null);
    });
  });
}
