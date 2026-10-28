import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ClockModule } from './clock/clock.module';
import { OriginMiddleware } from './common/origin.middleware';
import { env } from './config/env';
import { ContentModule } from './content/content.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { MeController } from './me/me.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { TestApiController } from './test-api/test-api.controller';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    ClockModule,
    AuditModule,
    AuthModule,
    HealthModule,
    UsersModule,
    ContentModule,
    AnnouncementsModule,
    DocumentsModule,
  ],
  controllers: [MeController, ...(env.enableTestApi ? [TestApiController] : [])],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginMiddleware).forRoutes('*path');
  }
}
