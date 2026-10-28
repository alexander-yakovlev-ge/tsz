import { APIRequestContext, expect, test } from '@playwright/test';
import {
  ADMIN,
  BASE_URL,
  createUser,
  del,
  login,
  post,
  put,
  resetClock,
  resetRateLimits,
  setClock,
  uniqueTag,
  uploadDocument,
} from './helpers';

const DAY = 24 * 60 * 60 * 1000;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n', 'latin1');

interface Announcement {
  id: string;
  isPinned: boolean;
  titleRu: string;
}

interface Category {
  id: string;
  nameRu: string;
  documentCount: number;
}

function announcementBody(tag: string, overrides: Record<string, unknown> = {}) {
  return {
    titleKa: `განცხადება ${tag}`,
    titleRu: `Объявление ${tag}`,
    titleEn: `Announcement ${tag}`,
    bodyKa: 'ტექსტი',
    bodyRu: 'Текст объявления',
    bodyEn: 'Announcement text',
    publishedAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

test.describe('Этап 3: публичный контент', () => {
  let admin: APIRequestContext;
  let category: Category;
  const announcements: string[] = [];
  const documents: string[] = [];

  async function createAnnouncement(body: Record<string, unknown>): Promise<string> {
    const response = await post(admin, '/api/announcements', body);
    expect(response.status()).toBe(201);
    const { announcement } = (await response.json()) as { announcement: { id: string } };
    announcements.push(announcement.id);
    return announcement.id;
  }

  async function upload(
    visibility: string,
    tag: string,
    file = { name: 'Протокол собрания.pdf', mimeType: 'application/pdf', buffer: PDF },
  ): Promise<string> {
    const response = await uploadDocument(
      admin,
      {
        titleKa: `ოქმი ${tag}`,
        titleRu: `Протокол ${tag}`,
        titleEn: `Minutes ${tag}`,
        categoryId: category.id,
        visibility,
      },
      file,
    );
    expect(response.status(), await response.text()).toBe(201);
    const { document } = (await response.json()) as { document: { id: string } };
    documents.push(document.id);
    return document.id;
  }

  test.beforeAll(async ({ playwright }) => {
    admin = await playwright.request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
    await resetRateLimits(admin);
    await login(admin, ADMIN.phone, ADMIN.password);
    const response = await admin.get('/api/document-categories');
    category = ((await response.json()) as { categories: Category[] }).categories[0];
  });

  test.afterAll(async () => {
    await resetClock(admin);
    for (const id of announcements) {
      await del(admin, `/api/announcements/${id}`);
    }
    for (const id of documents) {
      await del(admin, `/api/documents/${id}`);
    }
    await admin.dispose();
  });

  test.beforeEach(async ({ request }) => {
    await resetRateLimits(request);
  });

  // --- Объявления ---

  test('объявление с датой в будущем не видно, а после наступления даты появляется', async ({
    page,
    request,
  }) => {
    const tag = uniqueTag();
    const id = await createAnnouncement(
      announcementBody(tag, { publishedAt: new Date(Date.now() + 2 * DAY).toISOString() }),
    );
    const title = `Объявление ${tag}`;

    expect((await request.get(`/api/announcements/${id}`)).status()).toBe(404);
    await page.goto('/ru/announcements');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Объявления');
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveCount(0);

    await setClock(admin, 3 * DAY);
    try {
      await page.reload();
      await page.getByRole('link', { name: title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/ru/announcements/${id}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    } finally {
      await resetClock(admin);
    }
  });

  test('закреплённое объявление всегда первое', async ({ page, request }) => {
    const tag = uniqueTag();
    const pinned = await createAnnouncement(
      announcementBody(`${tag}-pinned`, {
        isPinned: true,
        publishedAt: new Date(Date.now() - 30 * DAY).toISOString(),
      }),
    );
    const fresh = await createAnnouncement(announcementBody(`${tag}-fresh`));

    const response = await request.get('/api/announcements');
    const { items } = (await response.json()) as { items: Announcement[] };
    const ids = items.map((item) => item.id);
    expect(items[0].isPinned).toBe(true);
    expect(ids.indexOf(pinned)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(pinned)).toBeLessThan(ids.indexOf(fresh));
    // Все закреплённые — перед всеми обычными.
    const firstRegular = items.findIndex((item) => !item.isPinned);
    expect(items.slice(firstRegular).every((item) => !item.isPinned)).toBe(true);

    await page.goto('/ru/announcements');
    await expect(page.getByTestId('announcement').first()).toContainText('Закреплено');
  });

  test('снятое объявление пропадает с сайта и возвращается', async ({ request }) => {
    const body = announcementBody(uniqueTag());
    const id = await createAnnouncement(body);
    expect((await request.get(`/api/announcements/${id}`)).status()).toBe(200);

    const archived = await put(admin, `/api/announcements/${id}`, { ...body, archived: true });
    expect((await archived.json()).announcement.status).toBe('ARCHIVED');
    expect((await request.get(`/api/announcements/${id}`)).status()).toBe(404);

    await put(admin, `/api/announcements/${id}`, { ...body, archived: false });
    expect((await request.get(`/api/announcements/${id}`)).status()).toBe(200);
  });

  test('администратор создаёт объявление через форму; все три перевода обязательны', async ({
    page,
  }) => {
    const tag = uniqueTag();
    await login(page.request, ADMIN.phone, ADMIN.password);
    await page.goto('/ru/admin/announcements/new');
    await page.locator('#titleKa').fill(`განცხადება ${tag}`);
    await page.locator('#titleRu').fill(`Собрание ${tag}`);
    await page.locator('#bodyKa').fill('კრება შაბათს');
    await page.locator('#bodyRu').fill('Собрание в **субботу**');
    await page.locator('#bodyEn').fill('Meeting on *Saturday*');
    await page.getByRole('button', { name: 'Создать' }).click();
    await expect(page.locator('form').getByRole('alert')).toHaveText('Проверьте заполнение полей');
    await expect(page.locator('#titleEn-error')).toHaveText('Обязательное поле');

    await page.locator('#titleEn').fill(`Meeting ${tag}`);
    await page.getByRole('button', { name: 'Создать' }).click();
    await expect(page).toHaveURL(/\/ru\/admin\/announcements\/[0-9a-f-]{36}$/);
    announcements.push(page.url().split('/').pop()!);

    await page.goto('/en/announcements');
    await page.getByRole('link', { name: `Meeting ${tag}`, exact: true }).click();
    await expect(page.locator('main em')).toHaveText('Saturday');
  });

  test('бейдж непрочитанных гаснет после открытия объявлений', async ({ page }) => {
    const resident = await createUser(admin);
    await createAnnouncement(announcementBody(uniqueTag()));
    await login(page.request, resident.phone, resident.password);

    await page.goto('/ru');
    const badge = page
      .getByRole('navigation', { name: 'Основное меню' })
      .getByTestId('unread-badge');
    await expect(badge).toBeVisible();

    await page.goto('/ru/announcements');
    await expect(badge).toHaveCount(0);
    await page.goto('/ru');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(badge).toHaveCount(0);
  });

  // --- Документы ---

  test('приватный документ: гостю 404, администратору скачивается', async ({ request }) => {
    const id = await upload('PRIVATE', uniqueTag());

    expect((await request.get(`/api/documents/${id}/download`, { maxRedirects: 0 })).status()).toBe(
      404,
    );
    const list = (await (await request.get('/api/documents')).json()) as {
      documents: { id: string }[];
    };
    expect(list.documents.map((document) => document.id)).not.toContain(id);

    const redirect = await admin.get(`/api/documents/${id}/download`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const location = redirect.headers()['location'];
    expect(location).toMatch(/\/files\/documents\/[0-9a-f-]{36}\?.*X-Amz-Expires=3600/);

    const file = await request.get(location);
    expect(file.status()).toBe(200);
    expect(await file.body()).toEqual(PDF);
    expect(file.headers()['content-disposition']).toContain(
      "filename*=UTF-8''%D0%9F%D1%80%D0%BE%D1%82%D0%BE%D0%BA%D0%BE%D0%BB",
    );
  });

  test('ссылка на скачивание без подписи не работает', async ({ request }) => {
    const id = await upload('PUBLIC', uniqueTag());
    const location = (
      await request.get(`/api/documents/${id}/download`, { maxRedirects: 0 })
    ).headers()['location'];
    const unsigned = location.split('?')[0];
    expect((await request.get(unsigned)).status()).toBe(403);
  });

  test('файл больше 20 МБ отклоняется', async () => {
    const buffer = Buffer.concat([PDF, Buffer.alloc(20 * 1024 * 1024 + 1 - PDF.length)]);
    const response = await uploadDocument(
      admin,
      {
        titleKa: 'დიდი',
        titleRu: 'Большой',
        titleEn: 'Large',
        categoryId: category.id,
        visibility: 'PUBLIC',
      },
      { name: 'large.pdf', mimeType: 'application/pdf', buffer },
    );
    expect(response.status()).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  test('.exe, переименованный в .pdf, отклоняется', async () => {
    const exe = Buffer.concat([Buffer.from('MZ\x90\x00\x03\x00', 'latin1'), Buffer.alloc(512)]);
    const response = await uploadDocument(
      admin,
      {
        titleKa: 'ფაილი',
        titleRu: 'Файл',
        titleEn: 'File',
        categoryId: category.id,
        visibility: 'PUBLIC',
      },
      { name: 'report.pdf', mimeType: 'application/pdf', buffer: exe },
    );
    expect(response.status()).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' });
  });

  test('публичный документ: поиск на странице и скачивание под исходным именем', async ({
    page,
  }) => {
    const tag = uniqueTag();
    await upload('PUBLIC', tag);
    await page.goto('/ru/documents');
    await page.getByLabel('Поиск по названию').fill(tag);
    await expect(page.getByTestId('document')).toHaveCount(1);
    await expect(page.getByTestId('document')).toContainText(`Протокол ${tag}`);

    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: `Скачать: Протокол ${tag}` }).click();
    expect((await download).suggestedFilename()).toBe('Протокол собрания.pdf');
  });

  test('после удаления документа файл исчезает из хранилища', async ({ request }) => {
    const id = await upload('PUBLIC', uniqueTag());
    const location = (
      await request.get(`/api/documents/${id}/download`, { maxRedirects: 0 })
    ).headers()['location'];
    expect((await request.get(location)).status()).toBe(200);

    expect((await del(admin, `/api/documents/${id}`)).status()).toBe(204);
    expect((await request.get(location)).status()).toBe(404);
    expect((await request.get(`/api/documents/${id}/download`)).status()).toBe(404);
  });

  test('категорию с документами удалить нельзя, пустую — можно', async () => {
    await upload('PUBLIC', uniqueTag());
    const busy = await del(admin, `/api/document-categories/${category.id}`);
    expect(busy.status()).toBe(409);
    expect(await busy.json()).toMatchObject({ code: 'CATEGORY_NOT_EMPTY' });

    const created = await post(admin, '/api/document-categories', {
      nameKa: 'სატესტო',
      nameRu: 'Тестовая',
      nameEn: 'Test',
      sortOrder: 999,
    });
    expect(created.status()).toBe(201);
    const { category: empty } = (await created.json()) as { category: Category };
    expect((await del(admin, `/api/document-categories/${empty.id}`)).status()).toBe(204);
  });

  // --- Контакты и главная ---

  test('телефоны ведут в WhatsApp; кнопка канала без ссылки не показывается', async ({ page }) => {
    const response = await put(admin, '/api/contacts', {
      chairmanNameKa: 'გიორგი',
      chairmanNameRu: 'Георгий',
      chairmanNameEn: 'Giorgi',
      chairmanPhone: '555 12 34 56',
      contactPersonNameKa: 'ნინო',
      contactPersonNameRu: 'Нино',
      contactPersonNameEn: 'Nino',
      contactPersonPhone: '+995 599 00 00 01',
      telegramUrl: 'https://t.me/tsz_e2e',
      whatsappUrl: '',
    });
    expect(response.status()).toBe(200);

    await page.goto('/ru/contacts');
    const chat = page.locator('main a[href="https://wa.me/995555123456"]');
    await expect(chat).toContainText('+995 555 12 34 56');
    await expect(chat).toHaveAttribute('target', '_blank');
    await expect(page.locator('main a[href="https://wa.me/995599000001"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Канал в Telegram' })).toHaveAttribute(
      'href',
      'https://t.me/tsz_e2e',
    );
    await expect(page.getByRole('link', { name: 'Канал в WhatsApp' })).toHaveCount(0);

    // Тот же блок — на главной.
    await page.goto('/ka');
    await expect(page.locator('a[href="https://wa.me/995555123456"]')).toBeVisible();
  });

  test('ссылка канала на чужой домен отклоняется', async () => {
    const contacts = (await (await admin.get('/api/contacts')).json()).contacts;
    const response = await put(admin, '/api/contacts', {
      ...contacts,
      telegramUrl: 'https://evil.example/t.me/tsz',
      whatsappUrl: 'https://wa.me/995555123456',
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'VALIDATION',
      fields: { telegramUrl: 'INVALID_URL', whatsappUrl: 'INVALID_URL' },
    });
  });

  test('приветствие на главной — Markdown без HTML', async ({ page }) => {
    const { home } = (await (await admin.get('/api/home')).json()) as {
      home: Record<string, string>;
    };
    const { updatedAt: _updatedAt, ...original } = home;
    try {
      const response = await put(admin, '/api/home', {
        ...original,
        introRu: '**Добро пожаловать** <script>window.injected = true</script><b>html</b>',
      });
      expect(response.status()).toBe(200);
      await page.goto('/ru');
      await expect(page.locator('main strong')).toHaveText('Добро пожаловать');
      await expect(page.locator('main script')).toHaveCount(0);
      await expect(page.locator('main b')).toHaveCount(0);
      expect(
        await page.evaluate(() => (window as { injected?: boolean }).injected),
      ).toBeUndefined();
    } finally {
      await put(admin, '/api/home', original);
    }
  });

  // --- SEO ---

  test('SEO: заголовок на языке страницы, hreflang, sitemap и robots', async ({
    page,
    request,
  }) => {
    await page.goto('/ka/documents');
    await expect(page).toHaveTitle(/^დოკუმენტები · /);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ka');
    await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute(
      'href',
      /\/ru\/documents$/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/ka\/documents$/);

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/en/contacts</loc>');
    expect(sitemap).toContain('hreflang="ka"');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /ru/admin');
  });
});
