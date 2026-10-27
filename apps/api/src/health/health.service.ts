import { Injectable, Logger } from '@nestjs/common';
import { aggregateHealth, HealthReport, HealthState } from '@tsz/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async check(): Promise<HealthReport> {
    const [db, storage] = await Promise.all([
      this.probe('db', () => this.prisma.ping()),
      this.probe('storage', () => this.storage.ping()),
    ]);
    return aggregateHealth({ db, storage });
  }

  private async probe(name: string, fn: () => Promise<void>): Promise<HealthState> {
    try {
      await fn();
      return 'ok';
    } catch (error) {
      this.logger.warn(`Health check "${name}" failed: ${(error as Error).message}`);
      return 'error';
    }
  }
}
