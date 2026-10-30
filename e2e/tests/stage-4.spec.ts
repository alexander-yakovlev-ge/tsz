import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APIRequestContext, expect, PlaywrightWorkerArgs, test } from '@playwright/test';
import {
  ADMIN,
  BASE_URL,
  createUser,
  del,
  importRegistry,
  login,
  post,
  put,
  resetRateLimits,
  uniquePhone,
  uniqueCadastralCode,
  uniqueTag,
  uploadDocument,
} from './helpers';

const FIXTURES = process.env.FIXTURES_DIR ?? path.resolve(__dirname, '../../data/fixtures');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n', 'latin1');
const KINDS = ['APARTMENT', 'PARKING', 'COMMERCIAL', 'TECHNICAL'] as const;

interface Manifest {
  units: { total: number; byKind: Record<(typeof KINDS)[number], number> };
  owners: {
    rows: number;
    ambiguous: Record<string, string>;
    company: { key: string; units: number };
    sample: { ownerKey: string; cadastralCode: string; otherCadastralCode: string };
    sampleIdNumber: string;
    withPhone: { idNumber: string; phone: string };
  };
}

interface Summary {
  create: number;
  update: number;
  unchanged: number;
  error: number;
}

interface Preview {
  ready: boolean;
  fileIssues: { code: string; column?: string }[];
  summary: {
    units: Summary;
    ownerships: Summary;
    newOwners: number;
    ownerUpdates: number;
    ambiguous: number;
  };
  owners: {
    key: string;
    match: { status: string; candidates?: { type: string; key?: string }[] };
  }[];
  rows: { line: number; issues: { code: string; column?: string }[] }[];
}

interface Unit {
  id: string;
  number: string;
  cadastralCode: string;
}

interface Owner {
  id: string;
  phone: string | null;
  units: { unitId: string }[];
  idNumbers?: string[];
}

/** Без make fixtures файлов нет — тест сообщает об этом, а не падает непонятной ошибкой. */
function fixture(name: string): Buffer {
  try {
    return readFileSync(path.join(FIXTURES, name));
  } catch {
    throw new Error(`Нет ${name} в ${FIXTURES}: сначала выполните make fixtures`);
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Этап 4: помещения, собственники, импорт', () => {
  let admin: APIRequestContext;
  let manifest: Manifest;

  async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
    const response = await request.get(url);
    expect(response.status(), `${url}: ${await response.text()}`).toBe(200);
    return (await response.json()) as T;
  }

  async function unitByCode(code: string): Promise<Unit> {
    const page = await getJson<{ items: Unit[] }>(
      admin,
      `/api/units?q=${encodeURIComponent(code)}`,
    );
    const unit = page.items.find((item) => item.cadastralCode === code);
    expect(unit, code).toBeTruthy();
    return unit!;
  }

  async function ownerByIdNumber(number: string): Promise<Owner> {
    const page = await getJson<{ items: Owner[]; total: number }>(admin, `/api/owners?q=${number}`);
    expect(page.total).toBe(1);
    return page.items[0]!;
  }

  /** Новая учётная запись RESIDENT, привязанная к собственнику, с сессией. */
  async function residentOf(
    playwright: PlaywrightWorkerArgs['playwright'],
    ownerId: string,
  ): Promise<APIRequestContext> {
    const phone = uniquePhone();
    const password = 'e2e-password-1';
    const link = await put(admin, `/api/owners/${ownerId}/user`, {
      mode: 'new',
      phone,
      language: 'ru',
      password,
    });
    expect(link.status(), await link.text()).toBe(200);
    const request = await playwright.request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    });
    await login(request, phone, password);
    return request;
  }

  test.beforeAll(async ({ playwright }) => {
    manifest = JSON.parse(fixture('manifest.json').toString('utf8')) as Manifest;
    admin = await playwright.request.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
    await resetRateLimits(admin);
    await login(admin, ADMIN.phone, ADMIN.password);
  });

  test.afterAll(async () => {
    await admin.dispose();
  });

  test.beforeEach(async ({ request }) => {
    await resetRateLimits(request);
  });

  async function preview(csv: Buffer | string, resolutions?: Record<string, string>) {
    const response = await importRegistry(admin, 'preview', csv, resolutions);
    expect(response.status(), await response.text()).toBe(200);
    return (await response.json()) as Preview;
  }

  test('импорт registry.csv: 312 помещений, спорные совпадения — на разбор, повтор ничего не меняет', async () => {
    const registry = fixture('registry.csv');
    const first = await preview(registry);
    expect(first.fileIssues).toEqual([]);
    expect(first.summary.units.error + first.summary.ownerships.error).toBe(0);
    if (first.summary.ambiguous > 0) {
      // Первый импорт: дубли и однофамилец не попадают в БД без решения администратора.
      const ambiguous = first.owners.filter((owner) => owner.match.status === 'ambiguous');
      expect(ambiguous.map((owner) => owner.key).sort()).toEqual(
        Object.keys(manifest.owners.ambiguous).sort(),
      );
      expect((await importRegistry(admin, 'commit', registry)).status()).toBe(409);
      const commit = await importRegistry(admin, 'commit', registry, manifest.owners.ambiguous);
      expect(commit.status(), await commit.text()).toBe(200);
    }

    const again = await preview(registry);
    expect(again.ready).toBe(true);
    expect(again.summary).toEqual({
      units: { create: 0, update: 0, unchanged: manifest.units.total, error: 0 },
      ownerships: { create: 0, update: 0, unchanged: manifest.owners.rows, error: 0 },
      newOwners: 0,
      ownerUpdates: 0,
      ambiguous: 0,
    });

    // Только помещения участка синтетической выписки.
    const all = await getJson<{ total: number }>(admin, '/api/units?q=05.30.39.005.');
    expect(all.total).toBe(manifest.units.total);
    expect(manifest.units.total).toBe(312);
    for (const kind of KINDS) {
      const page = await getJson<{ total: number }>(
        admin,
        `/api/units?q=05.30.39.005.&kind=${kind}`,
      );
      expect(page.total, kind).toBe(manifest.units.byKind[kind]);
    }

    // Юрлицо с 15 помещениями — по ID компании; номер шифруется, но ищется.
    const company = await ownerByIdNumber('405123456');
    expect(company.units).toHaveLength(manifest.owners.company.units);
    // Телефон из файла сохранён у собственника и ищется.
    const { withPhone } = manifest.owners;
    expect((await ownerByIdNumber(withPhone.idNumber)).phone).toBe(withPhone.phone);
    const byPhone = await getJson<{ items: Owner[] }>(
      admin,
      `/api/owners?q=${withPhone.phone.slice(-7)}`,
    );
    expect(byPhone.items.some((owner) => owner.phone === withPhone.phone)).toBe(true);
  });

  test('ошибки файла: нет столбцов, разные данные одного помещения, неверный телефон', async () => {
    const missing = await preview('cadastral_code;owner_key;owner_kind;registry_name\n');
    expect(missing.fileIssues).toEqual(
      expect.arrayContaining([{ column: 'kind', code: 'MISSING_COLUMN' }]),
    );

    const code = uniqueCadastralCode();
    const csv = [
      'cadastral_code;kind;number;floor;floor_label;area_m2;owner_key;owner_kind;registry_name;phone',
      `${code};PARKING;904;-3;;13.75;X1;PERSON;ტესტი ერთი;555 12 34 56`,
      `${code};PARKING;904;-3;;16.25;X2;PERSON;ტესტი ორი;`,
      `${code};PARKING;904;-3;;13.75;X3;PERSON;ტესტი სამი;12`,
    ].join('\n');
    const result = await preview(csv);
    expect(result.ready).toBe(false);
    const issues = Object.fromEntries(result.rows.map((row) => [row.line, row.issues]));
    expect(issues[2]).toEqual([]);
    expect(issues[3]).toContainEqual({ column: 'cadastral_code', code: 'UNIT_MISMATCH' });
    expect(issues[4]).toContainEqual({ column: 'phone', code: 'INVALID_VALUE' });
    expect((await importRegistry(admin, 'commit', csv)).status()).toBe(409);
  });

  test('вручную меняется только категория квартиры, импорт её не сбрасывает', async () => {
    const unit = await unitByCode(manifest.owners.sample.cadastralCode);
    const registry = fixture('registry.csv');
    const before = await getJson<{ unit: { tariffCategory: string } }>(
      admin,
      `/api/units/${unit.id}`,
    );

    // Помещения и собственников создаёт и меняет только импорт (ТЗ v1.12).
    expect((await post(admin, '/api/units', {})).status()).toBe(404);
    expect((await put(admin, `/api/units/${unit.id}`, {})).status()).toBe(404);
    expect((await del(admin, `/api/units/${unit.id}`)).status()).toBe(404);
    expect((await post(admin, `/api/units/${unit.id}/ownerships`, {})).status()).toBe(404);
    expect((await post(admin, '/api/owners', {})).status()).toBe(404);

    const set = await put(admin, `/api/units/${unit.id}/category`, {
      tariffCategory: 'PENSIONER',
    });
    expect(set.status(), await set.text()).toBe(200);
    expect((await preview(registry)).summary.units.update).toBe(0);
    await importRegistry(admin, 'commit', registry);
    const after = await getJson<{ unit: { tariffCategory: string } }>(
      admin,
      `/api/units/${unit.id}`,
    );
    expect(after.unit.tariffCategory).toBe('PENSIONER');

    const parking = await getJson<{ items: Unit[] }>(
      admin,
      '/api/units?kind=PARKING&q=05.30.39.005.',
    );
    const wrong = await put(admin, `/api/units/${parking.items[0]!.id}/category`, {
      tariffCategory: 'FULL',
    });
    expect(wrong.status()).toBe(400);

    const restore = await put(admin, `/api/units/${unit.id}/category`, {
      tariffCategory: before.unit.tariffCategory,
    });
    expect(restore.status(), await restore.text()).toBe(200);
  });

  test('дубли и однофамильцы внутри файла попадают в отчёт, а не в БД', async () => {
    const tag = uniqueTag();
    const [a, b, c] = [uniqueCadastralCode(), uniqueCadastralCode(), uniqueCadastralCode()];
    const name = `ტესტ${tag} გიორგაძე`;
    const unit = (code: string, number: string) => `${code};PARKING;${number};-3;;13.75`;
    const csv = [
      'cadastral_code;kind;number;floor;floor_label;area_m2;owner_key;owner_kind;registry_name;id_numbers',
      `${unit(a, '901')};A;PERSON;${name};AB${tag.slice(0, 6)}`,
      // То же лицо: слова в другом порядке, другой документ
      `${unit(b, '902')};B;PERSON;გიორგაძე ტესტ${tag};`,
      // Однофамилец: то же имя, другой паспорт
      `${unit(c, '903')};C;PERSON;${name};CD${tag.slice(0, 6)}`,
    ].join('\n');

    const result = await preview(csv);
    expect(result.ready).toBe(false);
    const match = Object.fromEntries(result.owners.map((owner) => [owner.key, owner.match]));
    expect(match.A!.status).toBe('new');
    expect(match.B!.status).toBe('ambiguous');
    expect(match.B!.candidates).toContainEqual(expect.objectContaining({ type: 'key', key: 'A' }));
    expect(match.C!.status).toBe('ambiguous');

    // Без решений ничего не применяется: ни собственников, ни помещений.
    expect((await importRegistry(admin, 'commit', csv)).status()).toBe(409);
    expect((await getJson<{ total: number }>(admin, `/api/owners?q=${tag}`)).total).toBe(0);
    expect((await getJson<{ total: number }>(admin, `/api/units?q=${a}`)).total).toBe(0);

    const resolved = await preview(csv, { B: 'key:A', C: 'new' });
    expect(resolved.ready).toBe(true);
    expect(resolved.summary.newOwners).toBe(2);
  });

  test('IDOR: жилец видит только своё помещение, номеров документов в /api/me нет', async ({
    playwright,
  }) => {
    const { sample, sampleIdNumber } = manifest.owners;
    const owner = await ownerByIdNumber(sampleIdNumber);
    const mine = await unitByCode(sample.cadastralCode);
    const other = await unitByCode(sample.otherCadastralCode);
    const otherDoc = await admin.post(`/api/units/${other.id}/documents`, {
      headers: { Origin: BASE_URL },
      multipart: {
        kind: 'OTHER',
        file: { name: 'выписка.pdf', mimeType: 'application/pdf', buffer: PDF },
      },
    });
    expect(otherDoc.status(), await otherDoc.text()).toBe(201);
    const otherDocId = ((await otherDoc.json()) as { document: { id: string } }).document.id;

    const resident = await residentOf(playwright, owner.id);
    const me = await resident.get('/api/me/units');
    const text = await me.text();
    const body = JSON.parse(text) as { units: { id: string }[]; owners: { id: string }[] };
    expect(body.units.map((unit) => unit.id)).toEqual([mine.id]);
    expect(text).not.toContain(sampleIdNumber);
    expect(text).not.toMatch(/idNumbers|idHashes|cadastral|\+995/);

    expect((await resident.get(`/api/units/${mine.id}/documents`)).status()).toBe(200);
    expect((await resident.get(`/api/units/${other.id}/documents`)).status()).toBe(404);
    expect(
      (
        await resident.get(`/api/units/${other.id}/documents/${otherDocId}/download`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await resident.get(`/api/units/${mine.id}/documents/${otherDocId}/download`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(404);
    for (const url of ['/api/units', `/api/units/${mine.id}`, `/api/owners/${owner.id}`]) {
      expect((await resident.get(url)).status(), url).toBe(403);
    }

    // Отображаемое имя — только своего собственника.
    const own = await put(resident, `/api/me/owners/${owner.id}/display-name`, {
      displayName: 'Ivan',
    });
    expect(own.status()).toBe(200);
    const company = await ownerByIdNumber('405123456');
    const foreign = await put(resident, `/api/me/owners/${company.id}/display-name`, {
      displayName: 'Hacker',
    });
    expect(foreign.status()).toBe(404);
    await put(resident, `/api/me/owners/${owner.id}/display-name`, { displayName: '' });
    await del(admin, `/api/units/${other.id}/documents/${otherDocId}`);
    await resident.dispose();
  });

  test('документы OWNERS видят пользователи помещений, но не жильцы без помещений', async ({
    playwright,
  }) => {
    const categories = await getJson<{ categories: { id: string }[] }>(
      admin,
      '/api/document-categories',
    );
    const tag = uniqueTag();
    const upload = await uploadDocument(
      admin,
      {
        titleKa: `ოქმი ${tag}`,
        titleRu: `Протокол ${tag}`,
        titleEn: `Minutes ${tag}`,
        categoryId: categories.categories[0]!.id,
        visibility: 'OWNERS',
      },
      { name: 'protocol.pdf', mimeType: 'application/pdf', buffer: PDF },
    );
    expect(upload.status()).toBe(201);
    const documentId = ((await upload.json()) as { document: { id: string } }).document.id;

    const owner = await ownerByIdNumber(manifest.owners.sampleIdNumber);
    const resident = await residentOf(playwright, owner.id);
    expect((await resident.get(`/api/documents/${documentId}`)).status()).toBe(200);

    const stranger = await playwright.request.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    });
    const user = await createUser(admin, 'RESIDENT');
    await login(stranger, user.phone, user.password);
    expect((await stranger.get(`/api/documents/${documentId}`)).status()).toBe(404);

    await del(admin, `/api/documents/${documentId}`);
    await Promise.all([resident.dispose(), stranger.dispose()]);
  });

  test('представитель компании видит все помещения юрлица', async ({ playwright }) => {
    const company = await ownerByIdNumber('405123456');
    const representative = await residentOf(playwright, company.id);
    const me = (await (await representative.get('/api/me/units')).json()) as {
      owners: { id: string }[];
      units: { ownerIds: string[] }[];
    };
    expect(me.owners.map((owner) => owner.id)).toEqual([company.id]);
    expect(me.units).toHaveLength(manifest.owners.company.units);
    expect(me.units.every((unit) => unit.ownerIds.includes(company.id))).toBe(true);
    await representative.dispose();
  });

  test('натуральная сортировка: 5, 5ა, 5ბ, 5გ, 5დ, 6', async ({ page }) => {
    const apartments = await getJson<{ items: Unit[] }>(
      admin,
      '/api/units?kind=APARTMENT&q=05.30.39.005.',
    );
    expect(apartments.items.slice(4, 10).map((unit) => unit.number)).toEqual([
      '5',
      '5ა',
      '5ბ',
      '5გ',
      '5დ',
      '6',
    ]);

    // В интерфейсе на русском буква транслитерируется, поиск понимает «5а».
    await post(page.request, '/api/auth/login', { phone: ADMIN.phone, password: ADMIN.password });
    await page.goto('/ru/admin/units?q=5%D0%B0');
    await expect(page.getByRole('link', { name: 'Квартира 5а', exact: true })).toBeVisible();
  });

  test('кабинет: помещение и совладельцы без телефонов', async ({ page, playwright }) => {
    const owner = await ownerByIdNumber(manifest.owners.sampleIdNumber);
    const resident = await residentOf(playwright, owner.id);
    const state = await resident.storageState();
    await page.context().addCookies(state.cookies);
    await resident.dispose();

    const mine = await unitByCode(manifest.owners.sample.cadastralCode);
    await page.goto('/ru/account');
    await expect(page.getByTestId('unit-title')).toHaveText(`Квартира ${mine.number}`);
    await expect(page.getByTestId('unit-owners')).toContainText('вы');
    await expect(page.getByTestId('unit-owners')).not.toContainText('+995');
  });
});
