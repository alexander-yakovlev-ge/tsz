import type { SessionUser } from '@tsz/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';

/** Адрес API для серверных запросов Next.js внутри docker-сети (ТЗ п. 2.2). */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://api:3001';

/** GET к API с сервера: cookie пользователя пробрасывается (ТЗ п. 2.2). null — ответ не 2xx. */
export async function apiGet<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  return fetchJson<T>(path, cookieHeader ? { cookie: cookieHeader } : {});
}

/** GET к API без cookie — для sitemap и других ответов, не зависящих от пользователя. */
export function apiGetPublic<T>(path: string): Promise<T | null> {
  return fetchJson<T>(path, {});
}

async function fetchJson<T>(path: string, headers: Record<string, string>): Promise<T | null> {
  const response = await fetch(`${API_INTERNAL_URL}${path}`, { headers, cache: 'no-store' });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

/** Текущий пользователь по мнению API (с проверкой token_version). Один запрос на рендер страницы. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const result = await apiGet<{ user: SessionUser | null }>('/api/auth/session');
  return result?.user ?? null;
});
