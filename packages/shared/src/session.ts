import { jwtVerify, SignJWT } from 'jose';
import { isRole, Role } from './roles';

/** Cookie сессии и её срок жизни (ТЗ п. 5.5). */
export const SESSION_COOKIE = 'session';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
/** Если до истечения осталось меньше этого, выдаётся новая cookie. */
export const SESSION_RENEW_THRESHOLD_SECONDS = 12 * 60 * 60;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
} as const;

export interface SessionClaims {
  /** id пользователя */
  sub: string;
  role: Role;
  /** token_version пользователя на момент выдачи */
  tv: number;
  /** время истечения, секунды Unix */
  exp: number;
}

const ALGORITHM = 'HS256';

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  claims: Pick<SessionClaims, 'sub' | 'role' | 'tv'>,
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  return new SignJWT({ role: claims.role, tv: claims.tv })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(secretKey(secret));
}

/** Проверяет подпись и срок. Возвращает null для любого недействительного токена. */
export async function verifySessionToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: [ALGORITHM],
      currentDate: new Date(now),
    });
    const { sub, role, tv, exp } = payload;
    if (
      typeof sub !== 'string' ||
      !isRole(role) ||
      typeof tv !== 'number' ||
      typeof exp !== 'number'
    ) {
      return null;
    }
    return { sub, role, tv, exp };
  } catch {
    return null;
  }
}

export function needsRenewal(claims: SessionClaims, now: number = Date.now()): boolean {
  return claims.exp - now / 1000 < SESSION_RENEW_THRESHOLD_SECONDS;
}
