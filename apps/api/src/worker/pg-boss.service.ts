import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { env } from '../config/env';

/** Очередь и расписание фоновых задач на PostgreSQL (ТЗ п. 2). */
@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  readonly boss = new PgBoss({ connectionString: env.databaseUrl, schema: 'pgboss' });
  private started = false;

  async onModuleInit(): Promise<void> {
    this.boss.on('error', (error) => this.logger.error(error.message, error.stack));
    await this.boss.start();
    this.started = true;
    this.logger.log('pg-boss started');
  }

  async onModuleDestroy(): Promise<void> {
    this.started = false;
    await this.boss.stop({ graceful: true });
  }

  isStarted(): boolean {
    return this.started;
  }
}
