import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RateLimitResult, SlidingWindowLimiter } from './rate-limiter';

const LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

/** Rate limiting входа: не более 10 попыток за 15 минут с одного IP (ТЗ п. 5.1). */
@Injectable()
export class LoginLimiterService implements OnModuleDestroy {
  private readonly limiter = new SlidingWindowLimiter(LIMIT, WINDOW_MS);
  private readonly timer = setInterval(() => this.limiter.sweep(), WINDOW_MS).unref();

  hit(ip: string): RateLimitResult {
    return this.limiter.hit(ip);
  }

  reset(): void {
    this.limiter.reset();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }
}
