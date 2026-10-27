import 'reflect-metadata';
import { createServer } from 'node:http';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { aggregateHealth } from '@tsz/shared';
import { env } from './config/env';
import { PrismaService } from './prisma/prisma.service';
import { PgBossService } from './worker/pg-boss.service';
import { WorkerModule } from './worker/worker.module';

/** Процесс фоновых задач. Задачи регистрируются на следующих этапах (начисления, push). */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  const prisma = app.get(PrismaService);
  const pgBoss = app.get(PgBossService);

  // Внутренний health-эндпоинт для healthcheck контейнера (наружу не публикуется).
  const server = createServer(async (_req, res) => {
    let db: 'ok' | 'error' = 'ok';
    try {
      await prisma.ping();
    } catch {
      db = 'error';
    }
    const report = aggregateHealth({ db, queue: pgBoss.isStarted() ? 'ok' : 'error' });
    res.writeHead(report.status === 'ok' ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify(report));
  });
  server.listen(env.workerHealthPort, '0.0.0.0');
  process.once('SIGTERM', () => server.close());

  Logger.log(`Worker started, health on port ${env.workerHealthPort}`, 'Bootstrap');
}

void bootstrap();
