import type { ApiErrorBody } from '@tsz/shared';

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: ApiErrorBody | null };

/**
 * Запрос к API из браузера. Тот же домен, поэтому браузер сам отправляет cookie и Origin
 * (ТЗ п. 11). FormData уходит как multipart (загрузка файлов). status = 0 — нет связи с сервером.
 */
export async function apiRequest<T = void>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const multipart = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined || multipart ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, status: 0, error: null };
  }
  if (response.ok) {
    const data = response.status === 204 ? undefined : await response.json();
    return { ok: true, data: data as T };
  }
  // Caddy отклоняет слишком большой запрос сам, без тела ApiErrorBody.
  const error = (await response
    .json()
    .catch(() =>
      response.status === 413 ? { statusCode: 413, code: 'FILE_TOO_LARGE' } : null,
    )) as ApiErrorBody | null;
  return { ok: false, status: response.status, error };
}
