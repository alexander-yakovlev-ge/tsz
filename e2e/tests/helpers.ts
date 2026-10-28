import { APIRequestContext, APIResponse, expect } from '@playwright/test';

export const BASE_URL = process.env.BASE_URL ?? 'https://localhost';

export const ADMIN = {
  phone: process.env.ADMIN_PHONE ?? '+995555000000',
  password: process.env.ADMIN_PASSWORD ?? 'change-me-admin',
};

/** Браузер сам отправляет Origin на мутирующих запросах; в API-запросах теста — вручную. */
const ORIGIN = { Origin: BASE_URL };

export function post(
  request: APIRequestContext,
  path: string,
  data?: unknown,
): Promise<APIResponse> {
  return request.post(path, { headers: ORIGIN, data });
}

export function put(
  request: APIRequestContext,
  path: string,
  data?: unknown,
): Promise<APIResponse> {
  return request.put(path, { headers: ORIGIN, data });
}

export function del(request: APIRequestContext, path: string): Promise<APIResponse> {
  return request.delete(path, { headers: ORIGIN });
}

/** Сбрасывает лимит попыток входа (тестовый API, ENABLE_TEST_API=true). */
export async function resetRateLimits(request: APIRequestContext): Promise<void> {
  const response = await post(request, '/api/test/reset-rate-limits');
  expect(response.status(), 'тестовый API включён (ENABLE_TEST_API=true)').toBe(204);
}

export async function login(
  request: APIRequestContext,
  phone: string,
  password: string,
): Promise<void> {
  const response = await post(request, '/api/auth/login', { phone, password });
  expect(response.status()).toBe(200);
}

let phoneCounter = 0;

/** Уникальный грузинский номер +9955XXXXXXXX, чтобы тесты не мешали друг другу и повторным запускам. */
export function uniquePhone(): string {
  phoneCounter += 1;
  const value = (Date.now() * 100 + phoneCounter) % 100_000_000;
  return `+9955${String(value).padStart(8, '0')}`;
}

export interface CreatedUser {
  id: string;
  phone: string;
  password: string;
}

/** Создаёт пользователя от имени администратора (request должен быть авторизован как админ). */
export async function createUser(
  adminRequest: APIRequestContext,
  role: 'ADMIN' | 'RESIDENT' = 'RESIDENT',
  name = 'E2E user',
): Promise<CreatedUser> {
  const phone = uniquePhone();
  const password = 'e2e-password-1';
  const response = await post(adminRequest, '/api/users', {
    phone,
    name,
    role,
    language: 'ru',
    password,
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { user: { id: string; phone: string } };
  return { id: body.user.id, phone: body.user.phone, password };
}
