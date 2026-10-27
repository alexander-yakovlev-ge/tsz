import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { env } from '../config/env';

/**
 * Доступ к S3-совместимому хранилищу файлов (локально — SeaweedFS).
 * Бакет приватный: анонимного доступа нет, скачивание — через presigned URL (этап 3).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly bucket = env.s3.bucket;
  readonly client = new S3Client({
    endpoint: env.s3.endpoint,
    region: env.s3.region,
    forcePathStyle: true,
    credentials: { accessKeyId: env.s3.accessKey, secretAccessKey: env.s3.secretKey },
  });

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
