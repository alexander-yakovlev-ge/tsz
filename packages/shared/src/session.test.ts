import { needsRenewal, SESSION_TTL_SECONDS, signSessionToken, verifySessionToken } from './session';

const SECRET = 'test-secret-test-secret-test-secret!';
const HOUR = 60 * 60 * 1000;

describe('session token', () => {
  const now = Date.UTC(2026, 9, 27, 12);

  it('round-trips claims and sets a 24-hour expiry', async () => {
    const token = await signSessionToken({ sub: 'user-1', role: 'ADMIN', tv: 3 }, SECRET, now);
    const claims = await verifySessionToken(token, SECRET, now);
    expect(claims).toEqual({
      sub: 'user-1',
      role: 'ADMIN',
      tv: 3,
      exp: now / 1000 + SESSION_TTL_SECONDS,
    });
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signSessionToken({ sub: 'user-1', role: 'ADMIN', tv: 0 }, SECRET, now);
    await expect(verifySessionToken(token, `${SECRET}x`, now)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signSessionToken({ sub: 'user-1', role: 'RESIDENT', tv: 0 }, SECRET, now);
    await expect(verifySessionToken(token, SECRET, now + 25 * HOUR)).resolves.toBeNull();
  });

  it('rejects garbage', async () => {
    await expect(verifySessionToken('not-a-token', SECRET, now)).resolves.toBeNull();
  });

  it('asks for renewal when less than 12 hours remain', async () => {
    const token = await signSessionToken({ sub: 'user-1', role: 'RESIDENT', tv: 0 }, SECRET, now);
    const claims = await verifySessionToken(token, SECRET, now);
    expect(claims).not.toBeNull();
    expect(needsRenewal(claims!, now + 11 * HOUR)).toBe(false);
    expect(needsRenewal(claims!, now + 13 * HOUR)).toBe(true);
  });
});
