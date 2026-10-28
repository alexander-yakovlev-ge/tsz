import { defineConfig, devices } from '@playwright/test';

// E2E-тесты идут против развёрнутого стека через Caddy (plan.md, разд. 1.1, шаг 6).
export default defineConfig({
  testDir: './tests',
  // Последовательно: тесты входа делят один IP и общий лимит попыток (ТЗ п. 5.1).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://localhost',
    // Локальный сертификат выпущен внутренним CA Caddy.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
