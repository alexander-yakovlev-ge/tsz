import { APIRequestContext, expect, test } from '@playwright/test';
import { ADMIN, BASE_URL, createUser, del, login, post, put, resetRateLimits } from './helpers';

test.describe('Этап 2: авторизация, роли, мультиязычность', () => {
  let admin: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    admin = await playwright.request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
    await resetRateLimits(admin);
    await login(admin, ADMIN.phone, ADMIN.password);
  });

  test.afterAll(() => admin.dispose());

  test.beforeEach(async ({ request }) => {
    await resetRateLimits(request);
  });

  test('администратор входит через форму и попадает в админку', async ({ page }) => {
    await page.goto('/ru/login');
    await page.getByLabel('Телефон').fill(ADMIN.phone);
    await page.getByLabel('Пароль').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page).toHaveURL(/\/ru\/admin$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Администрирование');
  });

  test('неверный пароль и неизвестный телефон — одно общее сообщение', async ({ page }) => {
    await page.goto('/ru/login');
    await page.getByLabel('Телефон').fill(ADMIN.phone);
    await page.getByLabel('Пароль').fill('wrong-password');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Неверный телефон или пароль');

    await page.getByLabel('Телефон').fill('599 00 00 01');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Неверный телефон или пароль');
    await expect(page).toHaveURL(/\/ru\/login$/);
  });

  test('11-я попытка входа за 15 минут → 429', async ({ request }) => {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await post(request, '/api/auth/login', {
        phone: ADMIN.phone,
        password: 'wrong',
      });
      expect(response.status(), `попытка ${attempt}`).toBe(401);
    }
    const blocked = await post(request, '/api/auth/login', {
      phone: ADMIN.phone,
      password: ADMIN.password,
    });
    expect(blocked.status()).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
    expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
  });

  test('/ru/admin без сессии → /ru/login, после входа возврат обратно', async ({ page }) => {
    await page.goto('/ru/admin/users');
    await expect(page).toHaveURL(/\/ru\/login\?callbackUrl=%2Fru%2Fadmin%2Fusers$/);
    await page.getByLabel('Телефон').fill(ADMIN.phone);
    await page.getByLabel('Пароль').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page).toHaveURL(/\/ru\/admin\/users$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Пользователи');
  });

  test('чужой адрес возврата после входа игнорируется', async ({ page }) => {
    await page.goto('/ru/login?callbackUrl=//evil.example/');
    await page.getByLabel('Телефон').fill(ADMIN.phone);
    await page.getByLabel('Пароль').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page).toHaveURL(/\/ru\/admin$/);
  });

  for (const [browserLocale, expected] of [
    ['ru-RU', 'ru'],
    ['en-US', 'en'],
    ['ka-GE', 'ka'],
    ['fr-FR', 'ka'],
  ] as const) {
    test(`/admin с языком браузера ${browserLocale} → /${expected}`, async ({ browser }) => {
      const context = await browser.newContext({
        baseURL: BASE_URL,
        ignoreHTTPSErrors: true,
        locale: browserLocale,
      });
      const page = await context.newPage();
      await page.goto('/admin');
      await expect(page).toHaveURL(
        new RegExp(`/${expected}/login\\?callbackUrl=%2F${expected}%2Fadmin$`),
      );
      await context.close();
    });
  }

  test('смена роли сразу завершает сессию этого пользователя', async ({ page }) => {
    const user = await createUser(admin, 'ADMIN', 'Second admin');
    await login(page.request, user.phone, user.password);
    await page.goto('/ru/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Администрирование');

    const response = await put(admin, `/api/users/${user.id}`, {
      phone: user.phone,
      name: 'Second admin',
      role: 'RESIDENT',
      language: 'ru',
    });
    expect(response.status()).toBe(200);

    expect(await (await page.request.get('/api/auth/session')).json()).toEqual({ user: null });
    await page.goto('/ru/admin');
    await expect(page).toHaveURL(/\/ru\/login/);
  });

  test('сброс пароля завершает сессию и выдаёт временный пароль', async ({ page, playwright }) => {
    const user = await createUser(admin);
    await login(page.request, user.phone, user.password);
    await page.goto('/ru/account');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Личный кабинет');

    const response = await post(admin, `/api/users/${user.id}/reset-password`, {});
    expect(response.status()).toBe(200);
    const { temporaryPassword } = (await response.json()) as { temporaryPassword: string };
    expect(temporaryPassword).toMatch(/^[a-zA-Z2-9]{12}$/);

    await page.goto('/ru/account');
    await expect(page).toHaveURL(/\/ru\/login/);

    const fresh = await playwright.request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    });
    expect(
      (
        await post(fresh, '/api/auth/login', { phone: user.phone, password: user.password })
      ).status(),
    ).toBe(401);
    await login(fresh, user.phone, temporaryPassword);
    await fresh.dispose();
  });

  test('администратор создаёт пользователя, и тот входит с выданным паролем', async ({
    page,
    playwright,
  }) => {
    await login(page.request, ADMIN.phone, ADMIN.password);
    await page.goto('/ru/admin/users/new');
    const local = `5${String(Date.now()).slice(-8)}`;
    await page.getByLabel('Телефон').fill(`${local.slice(0, 3)} ${local.slice(3)}`);
    await page.getByLabel('Имя').fill('Нина Житель');
    await page.getByRole('button', { name: 'Создать' }).click();
    const password = await page.getByTestId('temporary-password').textContent();
    expect(password).toMatch(/^[a-zA-Z2-9]{12}$/);

    await page.getByRole('link', { name: 'К списку пользователей' }).click();
    await expect(page.getByRole('link', { name: `+995${local}` })).toBeVisible();

    const resident = await playwright.request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    });
    await login(resident, local, password!);
    expect(await (await resident.get('/api/auth/session')).json()).toMatchObject({
      user: { phone: `+995${local}`, name: 'Нина Житель', role: 'RESIDENT' },
    });
    await resident.dispose();
  });

  test('повторный телефон при создании отклоняется', async () => {
    const user = await createUser(admin);
    const response = await post(admin, '/api/users', {
      phone: user.phone,
      role: 'RESIDENT',
      language: 'ka',
    });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'PHONE_TAKEN' });
  });

  test('смена пароля в кабинете завершает сессии на других устройствах', async ({
    page,
    playwright,
  }) => {
    const user = await createUser(admin);
    const otherDevice = await playwright.request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    });
    await login(otherDevice, user.phone, user.password);
    await login(page.request, user.phone, user.password);

    await page.goto('/ru/account/change-password');
    await page.getByLabel('Текущий пароль').fill('not-my-password');
    await page.getByLabel('Новый пароль', { exact: true }).fill('new-password-2');
    await page.getByLabel('Повторите новый пароль').fill('new-password-2');
    await page.getByRole('button', { name: 'Сменить пароль' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText(
      'Текущий пароль указан неверно',
    );

    await page.getByLabel('Текущий пароль').fill(user.password);
    await page.getByLabel('Новый пароль', { exact: true }).fill('new-password-2');
    await page.getByLabel('Повторите новый пароль').fill('new-password-2');
    await page.getByRole('button', { name: 'Сменить пароль' }).click();
    await expect(page.getByRole('status')).toContainText('Пароль изменён');

    // Текущее устройство остаётся в системе, другое — выходит.
    await page.goto('/ru/account');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Личный кабинет');
    expect(await (await otherDevice.get('/api/auth/session')).json()).toEqual({ user: null });

    await otherDevice.dispose();
  });

  test('житель не попадает в админку и в API пользователей', async ({ page }) => {
    const user = await createUser(admin);
    await login(page.request, user.phone, user.password);
    expect((await page.request.get('/api/users')).status()).toBe(403);
    await page.goto('/ru/admin');
    await expect(page).toHaveURL(/\/ru\/login\?callbackUrl=%2Fru%2Fadmin$/);
  });

  test('администратор не может удалить себя или снять с себя роль', async () => {
    const { user } = (await (await admin.get('/api/auth/session')).json()) as {
      user: { id: string; phone: string; name: string | null; language: string };
    };
    const removeSelf = await del(admin, `/api/users/${user.id}`);
    expect(removeSelf.status()).toBe(400);
    expect(await removeSelf.json()).toMatchObject({ code: 'CANNOT_DELETE_SELF' });

    const demoteSelf = await put(admin, `/api/users/${user.id}`, { ...user, role: 'RESIDENT' });
    expect(demoteSelf.status()).toBe(400);
    expect(await demoteSelf.json()).toMatchObject({ code: 'CANNOT_DEMOTE_SELF' });
  });

  test('удалённый пользователь не может войти', async ({ request }) => {
    const user = await createUser(admin);
    expect((await del(admin, `/api/users/${user.id}`)).status()).toBe(204);
    const response = await post(request, '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });
    expect(response.status()).toBe(401);
  });

  test('cookie сессии: HttpOnly, Secure, SameSite=Lax', async ({ page, context }) => {
    await page.goto('/ru/login');
    await page.getByLabel('Телефон').fill(ADMIN.phone);
    await page.getByLabel('Пароль').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page).toHaveURL(/\/ru\/admin$/);
    const session = (await context.cookies()).find((cookie) => cookie.name === 'session');
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
  });

  test('запрос с чужим Origin отклоняется', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: { Origin: 'https://evil.example' },
      data: { phone: ADMIN.phone, password: ADMIN.password },
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'ORIGIN_MISMATCH' });
  });

  test('переключатель языка открывает ту же страницу на другом языке', async ({ page }) => {
    await page.goto('/ru/login');
    await page.getByRole('link', { name: 'EN' }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sign in');
    await page.getByRole('link', { name: 'ქა' }).click();
    await expect(page).toHaveURL(/\/ka\/login$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
  });

  test('выход завершает сессию', async ({ page }) => {
    await login(page.request, ADMIN.phone, ADMIN.password);
    await page.goto('/ru/admin');
    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page).toHaveURL(/\/ru$/);
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
    expect(await (await page.request.get('/api/auth/session')).json()).toEqual({ user: null });
  });
});
