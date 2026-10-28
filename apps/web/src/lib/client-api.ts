import type { ApiErrorBody } from '@tsz/shared';

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: ApiErrorBody | null };

/**
 * Запрос к API из браузера. Тот же домен, поэтому браузер сам отправляет cookie и Origin
 * (ТЗ п. 11). status = 0 — нет связи с сервером.
 */
export async function apiRequest<T = void>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, status: 0, error: null };
  }
  if (response.ok) {
    const data = response.status === 204 ? undefined : await response.json();
    return { ok: true, data: data as T };
  }
  const error = (await response.json().catch(() => null)) as ApiErrorBody | null;
  return { ok: false, status: response.status, error };
}
