import { Injectable } from '@nestjs/common';

/**
 * Текущее время для бизнес-логики (публикация объявлений). e2e сдвигает его через тестовый API,
 * чтобы проверить отложенную публикацию без ожидания (plan.md, этап 3).
 */
@Injectable()
export class ClockService {
  private offsetMs = 0;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  setOffset(offsetMs: number): void {
    this.offsetMs = offsetMs;
  }
}
