import { readFileSync } from 'node:fs';
import path from 'node:path';
import { APIRequestContext, expect, PlaywrightWorkerArgs, test } from '@playwright/test';
import {
  ADMIN,
  BASE_URL,
  createUser,
  del,
  importCsv,
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
  };
}

interface Summary {
  create: number;
  update: number;
  unchanged: number;
  error: number;
  newOwners?: number;
  ambiguous?: number;
}

interface Preview {
  ready: boolean;
  summary: Summary;
  owners?: {
    key: string;
    match: { status: string; candidates?: { type: string; key?: string }[] };
  }[];
}

interface Unit {
  id: string;
  number: string;
  cadastralCode: string;
}

interface Owner {
  id: string;
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
  const createdUnits: string[] = [];
  const createdOwners: string[] = [];

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

  async function createUnit(number: string, kind = 'PARKING'): Promise<Unit> {
    const response = await post(admin, '/api/units', {
      kind,
      cadastralCode: uniqueCadastralCode(),
      number,
      floor: -3,
      areaM2: '13.75',
      tariffCategory: kind === 'APARTMENT' ? 'FULL' : null,
    });
    expect(response.status(), await response.text()).toBe(201);
    const { unit } = (await response.json()) as { unit: Unit };
    createdUnits.push(unit.id);
    return unit;
  }

  async function createOwner(registryName: string, idNumbers: string[] = []): Promise<Owner> {
    const response = await post(admin, '/api/owners', { kind: 'PERSON', registryName, idNumbers });
    expect(response.status(), await response.text()).toBe(201);
    const { owner } = (await response.json()) as { owner: Owner };
    createdOwners.push(owner.id);
    return owner;
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
    // Помещение удаляется вместе с правами собственности, затем — собственники без помещений.
    for (const id of createdUnits) {
      await del(admin, `/api/units/${id}`);
    }
    for (const id of createdOwners) {
      await del(admin, `/api/owners/${id}`);
    }
    await admin.dispose();
  });

  test.beforeEach(async ({ request }) => {
    await resetRateLimits(request);
  });

  test('импорт units.csv: ровно 312 помещений по видам, повтор ничего не меняет', async () => {
    const units = fixture('units.csv');
    const first = (await (await importCsv(admin, 'units', 'preview', units)).json()) as Preview;
    expect(first.ready).toBe(true);
    expect(first.summary.error).toBe(0);
    if (first.summary.create + first.summary.update > 0) {
      const commit = await importCsv(admin, 'units', 'commit', units);
      expect(commit.status(), await commit.text()).toBe(200);
    }

    const again = (await (await importCsv(admin, 'units', 'preview', units)).json()) as Preview;
    expect(again.summary).toEqual({
      create: 0,
      update: 0,
      unchanged: manifest.units.total,
      error: 0,
    });

    // Только помещения участка синтетической выписки: e2e создаёт свои вне его.
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
  });

  test('импорт owners.csv: спорные совпадения — на разбор, повтор ничего не меняет', async () => {
    const owners = fixture('owners.csv');
    const first = (await (await importCsv(admin, 'owners', 'preview', owners)).json()) as Preview;
    expect(first.summary.error).toBe(0);
    if (first.summary.ambiguous! > 0) {
      // Первый импорт: дубли и однофамилец не попадают в БД без решения администратора.
      const ambiguous = first.owners!.filter((owner) => owner.match.status === 'ambiguous');
      expect(ambiguous.map((owner) => owner.key).sort()).toEqual(
        Object.keys(manifest.owners.ambiguous).sort(),
      );
      expect((await importCsv(admin, 'owners', 'commit', owners)).status()).toBe(409);
      const commit = await importCsv(admin, 'owners', 'commit', owners, manifest.owners.ambiguous);
      expect(commit.status(), await commit.text()).toBe(200);
    }

    const again = (await (await importCsv(admin, 'owners', 'preview', owners)).json()) as Preview;
    expect(again.ready).toBe(true);
    expect(again.summary).toMatchObject({
      create: 0,
      update: 0,
      unchanged: manifest.owners.rows,
      error: 0,
      newOwners: 0,
      ambiguous: 0,
    });

    // Юрлицо с 15 помещениями — по ID компании; номер шифруется, но ищется.
    const company = await ownerByIdNumber('405123456');
    expect(company.units).toHaveLength(manifest.owners.company.units);
  });

  test('дубли и однофамильцы внутри файла попадают в отчёт, а не в БД', async () => {
    const tag = uniqueTag();
    const [a, b, c] = [await createUnit('901'), await createUnit('902'), await createUnit('903')];
    const name = `ტესტ${tag} გიორგაძე`;
    const csv = [
      'cadastral_code;owner_key;owner_kind;registry_name;id_numbers;share;share_note;is_contact',
      `${a.cadastralCode};A;PERSON;${name};AB${tag.slice(0, 6)};;;`,
      // То же лицо: слова в другом порядке, другой документ
      `${b.cadastralCode};B;PERSON;გიორგაძე ტესტ${tag};;;;`,
      // Однофамилец: то же имя, другой паспорт
      `${c.cadastralCode};C;PERSON;${name};CD${tag.slice(0, 6)};;;`,
    ].join('\n');

    const preview = (await (await importCsv(admin, 'owners', 'preview', csv)).json()) as Preview;
    expect(preview.ready).toBe(false);
    const match = Object.fromEntries(preview.owners!.map((owner) => [owner.key, owner.match]));
    expect(match.A!.status).toBe('new');
    expect(match.B!.status).toBe('ambiguous');
    expect(match.B!.candidates).toContainEqual(expect.objectContaining({ type: 'key', key: 'A' }));
    expect(match.C!.status).toBe('ambiguous');

    expect((await importCsv(admin, 'owners', 'commit', csv)).status()).toBe(409);
    const before = await getJson<{ total: number }>(admin, `/api/owners?q=${tag}`);
    expect(before.total).toBe(0);

    const commit = await importCsv(admin, 'owners', 'commit', csv, { B: 'key:A', C: 'new' });
    expect(commit.status(), await commit.text()).toBe(200);
    const after = await getJson<{ items: Owner[]; total: number }>(admin, `/api/owners?q=${tag}`);
    expect(after.total).toBe(2);
    createdOwners.push(...after.items.map((owner) => owner.id));
    expect(after.items.map((owner) => owner.units.length).sort()).toEqual([1, 2]);
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

  test('слияние дублей переносит помещения и номера; собственника с помещениями не удалить', async () => {
    const tag = uniqueTag();
    const primary = await createOwner(`ოლღა ${tag}`, [`P${tag}`.slice(0, 12)]);
    const duplicate = await createOwner(`${tag} ოლღა`, [`D${tag}`.slice(0, 12)]);
    const [first, second] = [await createUnit('911'), await createUnit('912')];
    for (const [unit, owner] of [
      [first, primary],
      [second, duplicate],
    ] as const) {
      const response = await post(admin, `/api/units/${unit.id}/ownerships`, {
        ownerId: owner.id,
        share: '1/2',
        isContact: true,
      });
      expect(response.status(), await response.text()).toBe(201);
    }

    expect((await del(admin, `/api/owners/${primary.id}`)).status()).toBe(409);
    const merge = await post(admin, `/api/owners/${primary.id}/merge`, {
      duplicateId: duplicate.id,
    });
    expect(merge.status(), await merge.text()).toBe(201);
    const merged = ((await merge.json()) as { owner: Owner }).owner;
    expect(merged.units.map((unit) => unit.unitId).sort()).toEqual([first.id, second.id].sort());
    expect(merged.idNumbers!.sort()).toEqual(
      [`D${tag}`.slice(0, 12), `P${tag}`.slice(0, 12)].map((n) => n.toUpperCase()).sort(),
    );
    expect((await admin.get(`/api/owners/${duplicate.id}`)).status()).toBe(404);
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
