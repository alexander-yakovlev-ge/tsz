import { SlidingWindowLimiter } from './rate-limiter';

const MINUTE = 60 * 1000;

describe('SlidingWindowLimiter', () => {
  it('allows 10 attempts in 15 minutes and blocks the 11th', () => {
    const limiter = new SlidingWindowLimiter(10, 15 * MINUTE);
    const start = 0;
    for (let i = 0; i < 10; i++) {
      expect(limiter.hit('1.2.3.4', start + i * MINUTE).allowed).toBe(true);
    }
    const blocked = limiter.hit('1.2.3.4', start + 10 * MINUTE);
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 5 * 60 });
  });

  it('counts each IP separately', () => {
    const limiter = new SlidingWindowLimiter(1, 15 * MINUTE);
    expect(limiter.hit('1.1.1.1', 0).allowed).toBe(true);
    expect(limiter.hit('2.2.2.2', 0).allowed).toBe(true);
    expect(limiter.hit('1.1.1.1', 0).allowed).toBe(false);
  });

  it('frees attempts once they leave the window', () => {
    const limiter = new SlidingWindowLimiter(2, 15 * MINUTE);
    limiter.hit('ip', 0);
    limiter.hit('ip', MINUTE);
    expect(limiter.hit('ip', 2 * MINUTE).allowed).toBe(false);
    expect(limiter.hit('ip', 15 * MINUTE).allowed).toBe(true);
  });

  it('reset clears all counters', () => {
    const limiter = new SlidingWindowLimiter(1, 15 * MINUTE);
    limiter.hit('ip', 0);
    limiter.reset();
    expect(limiter.hit('ip', 0).allowed).toBe(true);
  });
});
