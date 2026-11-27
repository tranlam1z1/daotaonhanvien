import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { filePolicy } from './file-policy';

export function storageBucket() {
  return process.env.S3_BUCKET ?? 'educore36-files';
}

export function createStorageClient() {
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey))
    throw new Error(
      'S3_ACCESS_KEY and S3_SECRET_KEY must be configured together',
    );
  const endpoint = process.env.S3_ENDPOINT;

  return new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    forcePathStyle: Boolean(endpoint),
    requestChecksumCalculation: 'WHEN_REQUIRED',
    ...(accessKeyId &&
      secretAccessKey && { credentials: { accessKeyId, secretAccessKey } }),
  });
}

@Injectable()
export class ObjectStorage implements OnModuleDestroy {
  private client?: S3Client;

  private get s3() {
    return (this.client ??= createStorageClient());
  }

  async upload(
    storageKey: string,
    path: string,
    size: number,
    contentType: string,
  ) {
    const body = createReadStream(path);
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: storageBucket(),
          Key: storageKey,
          Body: body,
          ContentLength: size,
          ContentType: contentType,
          CacheControl: 'private, no-store',
        }),
      );
    } finally {
      body.destroy();
    }
  }

  async remove(storageKey: string) {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: storageBucket(), Key: storageKey }),
    );
  }

  async downloadTo(storageKey: string, path: string, maxBytes: number) {
    const signal = AbortSignal.timeout(30_000);
    const { Body } = await this.s3.send(
      new GetObjectCommand({ Bucket: storageBucket(), Key: storageKey }),
      { abortSignal: signal },
    );
    if (!(Body instanceof Readable)) throw new Error('Invalid S3 response');
    let bytes = 0;
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > maxBytes)
          return callback(new Error('Document is too large'));
        callback(null, chunk);
      },
    });
    await pipeline(Body, limit, createWriteStream(path, { flags: 'wx' }), {
      signal,
    });
  }

  async signDownload(
    file: { storageKey: string; contentType: string; name: string },
    disposition: 'attachment' | 'inline' = 'attachment',
  ) {
    const expiresIn = filePolicy().downloadSeconds;
    const encodedName = encodeURIComponent(file.name).replace(
      /['()*]/g,
      (character) => '%' + character.charCodeAt(0).toString(16).toUpperCase(),
    );
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: storageBucket(),
        Key: file.storageKey,
        ResponseCacheControl: 'private, no-store',
        ResponseContentType: file.contentType,
        ResponseContentDisposition:
          disposition + "; filename*=UTF-8''" + encodedName,
      }),
      { expiresIn },
    );
    return { url, expiresIn };
  }

  onModuleDestroy() {
    this.client?.destroy();
  }
}
