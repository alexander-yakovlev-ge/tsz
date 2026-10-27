import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { LoginLimiterService } from './login-limiter.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [SessionService, LoginLimiterService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [SessionService, LoginLimiterService],
})
export class AuthModule {}
