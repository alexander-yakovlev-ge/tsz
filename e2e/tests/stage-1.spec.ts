import { expect, test } from '@playwright/test';

test.describe('Этап 1: инфраструктура', () => {
  test('главная открывается через Caddy', async ({ page }) => {
    await page.goto('/ru');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Тамар Мепе, 1');
  });

  test('/api/health сообщает о доступности БД и хранилища', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      checks: { db: 'ok', storage: 'ok' },
    });
  });

  test('ответы не раскрывают технологию сервера', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });
});
