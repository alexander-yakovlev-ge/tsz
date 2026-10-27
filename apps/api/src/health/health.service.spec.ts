import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  async function createService(db: () => Promise<void>, storage: () => Promise<void>) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { ping: db } },
        { provide: StorageService, useValue: { ping: storage } },
      ],
    }).compile();
    return moduleRef.get(HealthService);
  }

  it('reports ok when database and storage respond', async () => {
    const service = await createService(
      () => Promise.resolve(),
      () => Promise.resolve(),
    );
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      checks: { db: 'ok', storage: 'ok' },
    });
  });

  it('reports the failing dependency', async () => {
    const service = await createService(
      () => Promise.resolve(),
      () => Promise.reject(new Error('down')),
    );
    await expect(service.check()).resolves.toEqual({
      status: 'error',
      checks: { db: 'ok', storage: 'error' },
    });
  });
});
