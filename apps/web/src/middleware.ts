// Модуль сессии, а не весь пакет: так в middleware не попадают zod и libphonenumber.
import {
  needsRenewal,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_TTL_SECONDS,
  signSessionToken,
  verifySessionToken,
} from '@tsz/shared/dist/session';
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const handleI18n = createMiddleware(routing);

const LOCALE_PATH = new RegExp(`^/(${routing.locales.join('|')})(/.*)?$`);

function isSection(path: string, section: string): boolean {
  return path === section || path.startsWith(`${section}/`);
}

/**
 * Язык (next-intl), защита страниц и продление сессии (ТЗ п. 5.5, 10, 11).
 * Middleware проверяет только подпись и срок токена. token_version и окончательные права
 * проверяет API: устаревший токен пропускается сюда, но страница получит от API «не вошёл».
 */
export default async function middleware(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.JWT_SECRET ?? '';
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token && secret ? await verifySessionToken(token, secret) : null;

  const match = LOCALE_PATH.exec(request.nextUrl.pathname);
  if (match) {
    const [, locale, rest = '/'] = match;
    const needsAdmin = isSection(rest, '/admin');
    const needsUser = needsAdmin || isSection(rest, '/account');
    if ((needsAdmin && claims?.role !== 'ADMIN') || (needsUser && !claims)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.search = '';
      url.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
  }

  const response = handleI18n(request);
  // Страницы рендерятся на сервере, и cookie из ответов API до браузера не доходит,
  // поэтому сессию при переходах по страницам продлевает middleware.
  if (claims && needsRenewal(claims)) {
    response.cookies.set(SESSION_COOKIE, await signSessionToken(claims, secret), {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: SESSION_TTL_SECONDS,
    });
  }
  return response;
}

export const config = {
  // Без префикса языка: /api, служебные файлы Next.js и всё, что с точкой (sw.js, manifest, иконки).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
