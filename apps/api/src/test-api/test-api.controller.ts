import { Body, Controller, Delete, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../auth/decorators';
import { LoginLimiterService } from '../auth/login-limiter.service';
import { ClockService } from '../clock/clock.service';
import { ZodPipe } from '../common/zod.pipe';

const clockSchema = z.object({ offsetMs: z.number().int() });

/**
 * Тестовый API для e2e (ТЗ п. 11). Модуль подключается, только если ENABLE_TEST_API=true;
 * иначе маршруты не существуют и отвечают 404.
 */
@Controller('test')
@Public()
export class TestApiController {
  constructor(
    private readonly loginLimiter: LoginLimiterService,
    private readonly clock: ClockService,
  ) {}

  @Post('reset-rate-limits')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetRateLimits(): void {
    this.loginLimiter.reset();
  }

  /** Сдвиг часов API: «наступление» даты публикации объявления. */
  @Put('clock')
  @HttpCode(HttpStatus.NO_CONTENT)
  setClock(@Body(new ZodPipe(clockSchema)) body: z.output<typeof clockSchema>): void {
    this.clock.setOffset(body.offsetMs);
  }

  @Delete('clock')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetClock(): void {
    this.clock.setOffset(0);
  }
}
