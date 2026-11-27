import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createReadStream } from 'node:fs';
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

  async signDownload(file: {
    storageKey: string;
    contentType: string;
    name: string;
  }) {
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
          "attachment; filename*=UTF-8''" + encodedName,
      }),
      { expiresIn },
    );
    return { url, expiresIn };
  }

  onModuleDestroy() {
    this.client?.destroy();
  }
}
