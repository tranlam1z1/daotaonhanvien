import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { isUtf8 } from 'node:buffer';
import { open as openFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { open as openZip } from 'yauzl';

const mebibyte = 1024 ** 2;
export const bytesPerStorageGb = 1024n ** 3n;

function integerSetting(name: string, fallback: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw new Error(name + ' must be a positive integer up to ' + max);
  return value;
}

export function filePolicy() {
  return {
    documentBytes: integerSetting('FILE_DOCUMENT_MAX_MB', 50, 5120) * mebibyte,
    videoBytes: integerSetting('FILE_VIDEO_MAX_MB', 500, 5120) * mebibyte,
    downloadSeconds: integerSetting('FILE_DOWNLOAD_TTL_SECONDS', 300, 3600),
  };
}

type UploadFormat = {
  contentType: string;
  signature: (header: Buffer) => boolean;
  officePart?: string;
  video?: boolean;
};

function begins(header: Buffer, hex: string) {
  const bytes = Buffer.from(hex, 'hex');
  return header.subarray(0, bytes.length).equals(bytes);
}

const compoundOffice = (header: Buffer) => begins(header, 'd0cf11e0a1b11ae1');
const zipSignature = (header: Buffer) => begins(header, '504b0304');
const isoVideo = (header: Buffer) => header.toString('ascii', 4, 8) === 'ftyp';

const jpeg: UploadFormat = {
  contentType: 'image/jpeg',
  signature: (header) => begins(header, 'ffd8ff'),
};
const mp4: UploadFormat = {
  contentType: 'video/mp4',
  signature: isoVideo,
  video: true,
};
const formats: ReadonlyMap<string, UploadFormat> = new Map([
  [
    '.pdf',
    {
      contentType: 'application/pdf',
      signature: (header) => begins(header, '255044462d'),
    },
  ],
  ['.doc', { contentType: 'application/msword', signature: compoundOffice }],
  [
    '.xls',
    { contentType: 'application/vnd.ms-excel', signature: compoundOffice },
  ],
  [
    '.ppt',
    { contentType: 'application/vnd.ms-powerpoint', signature: compoundOffice },
  ],
  [
    '.docx',
    {
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      signature: zipSignature,
      officePart: 'word/document.xml',
    },
  ],
  [
    '.xlsx',
    {
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      signature: zipSignature,
      officePart: 'xl/workbook.xml',
    },
  ],
  [
    '.pptx',
    {
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      signature: zipSignature,
      officePart: 'ppt/presentation.xml',
    },
  ],
  ['.jpg', jpeg],
  ['.jpeg', jpeg],
  [
    '.png',
    {
      contentType: 'image/png',
      signature: (header) => begins(header, '89504e470d0a1a0a'),
    },
  ],
  [
    '.gif',
    {
      contentType: 'image/gif',
      signature: (header) =>
        ['GIF87a', 'GIF89a'].includes(header.toString('ascii', 0, 6)),
    },
  ],
  [
    '.webp',
    {
      contentType: 'image/webp',
      signature: (header) =>
        header.toString('ascii', 0, 4) === 'RIFF' &&
        header.toString('ascii', 8, 12) === 'WEBP',
    },
  ],
  ['.mp4', mp4],
  ['.m4v', mp4],
  [
    '.mov',
    { contentType: 'video/quicktime', signature: isoVideo, video: true },
  ],
  [
    '.webm',
    {
      contentType: 'video/webm',
      signature: (header) =>
        begins(header, '1a45dfa3') && header.includes('webm'),
      video: true,
    },
  ],
]);

export type DiskUpload = { path: string; originalname: string; size: number };

async function isOfficeDocument(path: string, part: string) {
  return new Promise<boolean>((resolve) => {
    openZip(path, { lazyEntries: true }, (error, archive) => {
      if (error || !archive) return resolve(false);
      if (archive.entryCount > 20_000) {
        archive.close();
        return resolve(false);
      }
      const required = new Set(['[Content_Types].xml', part]);
      archive.on('error', () => {
        archive.close();
        resolve(false);
      });
      archive.on('entry', (entry) => {
        required.delete(entry.fileName);
        if (required.size === 0) {
          archive.close();
          resolve(true);
        } else {
          archive.readEntry();
        }
      });
      archive.once('end', () => resolve(false));
      archive.readEntry();
    });
  });
}

export async function validateFile({ path, size, originalname }: DiskUpload) {
  // Multipart filename parameters can arrive decoded as ISO-8859-1.
  const latin1 = Buffer.from(originalname, 'latin1');
  const decoded =
    latin1.toString('latin1') === originalname && isUtf8(latin1)
      ? latin1.toString('utf8')
      : originalname;
  const name = basename(decoded.replace(/\\/g, '/')).trim();
  if (!name || Buffer.byteLength(name) > 255 || /\p{Cc}/u.test(name) || !size)
    throw new BadRequestException('Tên tệp không hợp lệ hoặc tệp rỗng.');

  const format = formats.get(extname(name).toLowerCase());
  const invalidType = () =>
    new UnsupportedMediaTypeException(
      'Loại tệp không được hỗ trợ hoặc nội dung không khớp phần mở rộng.',
    );
  if (!format) throw invalidType();
  const { documentBytes, videoBytes } = filePolicy();
  const limit = format.video ? videoBytes : documentBytes;
  if (size > limit)
    throw new PayloadTooLargeException(
      `Tệp vượt giới hạn ${limit / mebibyte} MB.`,
    );

  const file = await openFile(path, 'r');
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(64), 0, 64, 0);
    if (!format.signature(buffer.subarray(0, bytesRead))) throw invalidType();
  } finally {
    await file.close();
  }
  if (format.officePart && !(await isOfficeDocument(path, format.officePart)))
    throw invalidType();

  return { name, sizeBytes: BigInt(size), contentType: format.contentType };
}
