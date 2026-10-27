export interface RateLimitResult {
  allowed: boolean;
  /** Через сколько секунд освободится попытка (при allowed = false) */
  retryAfterSeconds: number;
}

/**
 * Скользящее окно в памяти процесса. API работает в одном экземпляре, поэтому
 * общее хранилище не нужно; после перезапуска счётчики обнуляются.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  hit(key: string, now: number = Date.now()): RateLimitResult {
    const recent = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((oldest + this.windowMs - now) / 1000),
      };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Удаляет ключи без попыток в окне, чтобы карта не росла бесконечно. */
  sweep(now: number = Date.now()): void {
    for (const [key, times] of this.hits) {
      if (times.every((time) => now - time >= this.windowMs)) {
        this.hits.delete(key);
      }
    }
  }

  reset(): void {
    this.hits.clear();
  }
}
