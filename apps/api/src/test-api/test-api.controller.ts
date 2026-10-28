import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { LoginLimiterService } from '../auth/login-limiter.service';

/**
 * Тестовый API для e2e (ТЗ п. 11). Модуль подключается, только если ENABLE_TEST_API=true;
 * иначе маршруты не существуют и отвечают 404.
 */
@Controller('test')
@Public()
export class TestApiController {
  constructor(private readonly loginLimiter: LoginLimiterService) {}

  @Post('reset-rate-limits')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetRateLimits(): void {
    this.loginLimiter.reset();
  }
}
