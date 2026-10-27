import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PgBossService } from './pg-boss.service';

@Module({
  imports: [PrismaModule],
  providers: [PgBossService],
})
export class WorkerModule {}
