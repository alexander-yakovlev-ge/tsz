import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Запросы приходят через Caddy: реальный IP клиента — в X-Forwarded-For.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.enableShutdownHooks();
  await app.listen(env.port, '0.0.0.0');
  Logger.log(`API listening on port ${env.port}`, 'Bootstrap');
}

void bootstrap();
