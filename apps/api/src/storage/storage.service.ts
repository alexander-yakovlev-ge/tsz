import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { env } from '../config/env';

const PRESIGNED_TTL_SECONDS = 60 * 60;

function createClient(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: env.s3.region,
    forcePathStyle: true,
    credentials: { accessKeyId: env.s3.accessKey, secretAccessKey: env.s3.secretKey },
  });
}

/** Скачивание под исходным именем файла; RFC 6266 — запасное ASCII-имя и имя в UTF-8. */
export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  // encodeURIComponent оставляет ' ( ) *, а в filename* они недопустимы (RFC 5987).
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Доступ к S3-совместимому хранилищу файлов (локально — SeaweedFS).
 * Бакет приватный: анонимного доступа нет, скачивание — через presigned URL (ТЗ п. 11).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly bucket = env.s3.bucket;
  readonly client = createClient(env.s3.endpoint);
  /** Клиенты для подписи ссылок по публичному адресу сайта (по одному на адрес). */
  private readonly publicClients = new Map<string, S3Client>();

  async onModuleInit(): Promise<void> {
    // Хранилище может подняться позже API (перезагрузка сервера) — ждём до ~60 секунд.
    for (let attempt = 1; ; attempt++) {
      try {
        await this.ensureBucket();
        return;
      } catch (error) {
        if (attempt >= 30) {
          throw error;
        }
        this.logger.warn(`Storage unavailable (attempt ${attempt}): ${(error as Error).message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  async ensureBucket(): Promise<void> {
    if (await this.bucketExists()) {
      return;
    }
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    this.logger.log(`Bucket "${this.bucket}" created`);
  }

  async put(key: string, body: Buffer, contentType: string, filename: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentDisposition: contentDisposition(filename),
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Presigned URL на скачивание, TTL 1 час (ТЗ п. 6.3). Ссылка ведёт на адрес сайта
   * (`origin`): Caddy проксирует `/<bucket>/*` в хранилище, сохраняя Host, по которому
   * хранилище проверяет подпись.
   */
  presignedDownloadUrl(key: string, origin: string): Promise<string> {
    let client = this.publicClients.get(origin);
    if (!client) {
      client = createClient(origin);
      this.publicClients.set(origin, client);
    }
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: PRESIGNED_TTL_SECONDS,
    });
  }

  async ping(): Promise<void> {
    if (!(await this.bucketExists())) {
      throw new Error(`Bucket "${this.bucket}" is missing`);
    }
  }

  private async bucketExists(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}
