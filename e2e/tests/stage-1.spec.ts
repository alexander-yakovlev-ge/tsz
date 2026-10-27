import { expect, test } from '@playwright/test';

test.describe('Этап 1: инфраструктура', () => {
  test('главная открывается через Caddy и видит API', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ТСЖ');
    await expect(page.getByTestId('api-status')).toHaveText('ok');
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
