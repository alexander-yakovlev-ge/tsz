/**
 * Синтетическая выписка из реестра (docs/plan.md, разд. 1.3; docs/registry-analysis.md).
 * Повторяет структуру настоящей: коды и номера помещений, виды, площади, совладельцы и доли,
 * юрлицо с 15 помещениями, дубли с другим написанием и однофамильцы. Имена и номера вымышлены.
 */

/** Детерминированный генератор (mulberry32): одинаковые файлы при каждом запуске. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARCEL = '05.30.39.005.01';

export type UnitKind = 'APARTMENT' | 'PARKING' | 'COMMERCIAL' | 'TECHNICAL';

export interface UnitRow {
  cadastral_code: string;
  kind: UnitKind;
  number: string;
  floor: string;
  floor_label: string;
  area_m2: string;
  tariff_category: string;
}

export interface OwnerRow {
  cadastral_code: string;
  owner_key: string;
  owner_kind: 'PERSON' | 'COMPANY';
  registry_name: string;
  id_numbers: string;
  share: string;
  share_note: string;
  is_contact: string;
}

/** Что e2e ожидает от импорта этих файлов. */
export interface Manifest {
  units: { total: number; byKind: Record<UnitKind, number> };
  owners: {
    rows: number;
    keys: number;
    /** Метки, требующие решения администратора, и решение, которое принимает тест */
    ambiguous: Record<string, string>;
    /** Сколько собственников окажется в БД после импорта с этими решениями */
    expectedOwners: number;
    company: { key: string; units: number };
    /** Для IDOR-теста: два помещения разных собственников */
    sample: { ownerKey: string; cadastralCode: string; otherCadastralCode: string };
    /** Номер документа собственника sample — его не должно быть в ответах /api/me/* */
    sampleIdNumber: string;
  };
}

const FIRST_NAMES = [
  'გიორგი',
  'ნინო',
  'დავით',
  'მარიამ',
  'ლევან',
  'ანა',
  'ირაკლი',
  'თამარ',
  'ნიკოლოზ',
  'ეკატერინე',
  'ზურაბ',
  'სალომე',
  'ალექსანდრე',
  'ნათია',
  'ლაშა',
  'ქეთევან',
  'გოგა',
  'მაია',
  'ვახტანგ',
  'ელენე',
  'ივანე',
  'ოლგა',
  'სერგეი',
  'ტატიანა',
  'მიხეილ',
  'ირინა',
  'ანდრეი',
  'ნატალია',
  'დმიტრი',
  'ელენა',
];

const LAST_NAMES = [
  'ბერიძე',
  'კაპანაძე',
  'გელაშვილი',
  'მაისურაძე',
  'ლომიძე',
  'ჯაფარიძე',
  'ხარაიშვილი',
  'ცინცაძე',
  'ნოზაძე',
  'მამულაშვილი',
  'ქავთარაძე',
  'ჩიქოვანი',
  'შენგელია',
  'ბოლქვაძე',
  'ტაბიძე',
  'ხუციშვილი',
  'ივანოვი',
  'პეტროვი',
  'სმირნოვი',
  'კუზნეცოვი',
  'პოპოვი',
  'სოკოლოვი',
  'ლებედევი',
  'კოზლოვი',
  'ნოვიკოვი',
  'მოროზოვი',
  'ვოლკოვი',
  'სოლოვიოვი',
  'ვასილიევი',
  'ზაიცევი',
  'პავლოვი',
  'სემიონოვი',
];

/** То же правило «похожих имён», что в импорте API: случайных совпадений в данных быть не должно. */
function similarNames(a: string, b: string): boolean {
  const left = [...new Set(a.split(' '))];
  const right = [...new Set(b.split(' '))];
  if ([...left].sort().join(' ') === [...right].sort().join(' ')) {
    return true;
  }
  const onlyLeft = left.filter((word) => !right.includes(word));
  const onlyRight = right.filter((word) => !left.includes(word));
  if (left.length !== right.length || onlyLeft.length !== 1 || onlyRight.length !== 1) {
    return false;
  }
  const [x, y] = [onlyLeft[0]!, onlyRight[0]!];
  let previous = Array.from({ length: y.length + 1 }, (_, index) => index);
  for (let i = 1; i <= x.length; i++) {
    const current = [i];
    for (let j = 1; j <= y.length; j++) {
      current.push(
        Math.min(
          previous[j]! + 1,
          current[j - 1]! + 1,
          previous[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1),
        ),
      );
    }
    previous = current;
  }
  return previous[y.length]! <= (Math.min(x.length, y.length) >= 10 ? 2 : 1);
}

function code(section: string, number: string): string {
  return `${PARCEL}.${section}.${number}`;
}

function pad(value: number): string {
  return String(value).padStart(3, '0');
}

export function generateUnits(): UnitRow[] {
  const next = random(4);
  const units: UnitRow[] = [];
  const area = (min: number, max: number) => (min + next() * (max - min)).toFixed(2);
  const category = () => {
    const value = next();
    return value < 0.8 ? 'FULL' : value < 0.95 ? 'BLACK_FRAME' : 'PENSIONER';
  };
  const apartment = (number: string, codeNumber: string, floor: number, areaM2: string) =>
    units.push({
      cadastral_code: code('01', codeNumber),
      kind: 'APARTMENT',
      number,
      floor: String(floor),
      floor_label: '',
      area_m2: areaM2,
      tariff_category: category(),
    });

  // Квартиры 001–257 без 133, 228, 229: 132 — объединённая 132+133 под старым кодом.
  for (let n = 1; n <= 257; n++) {
    if ([133, 228, 229].includes(n)) {
      continue;
    }
    const floor = Math.min(20, 2 + Math.floor((n - 1) / 14));
    apartment(String(n), pad(n), floor, n === 132 ? '109.80' : area(30.08, 98));
    // Большие квартиры 2-го этажа с грузинскими буквами — сразу после 5.
    if (n === 5) {
      const lettered: [string, string][] = [
        ['ა', '128.49'],
        ['ბ', '636.17'],
        ['გ', '209.47'],
        ['დ', '265.73'],
      ];
      for (const [letter, areaM2] of lettered) {
        apartment(`5${letter}`, `005${letter}`, 2, areaM2);
      }
    }
  }
  // Квартира N228 — объединённые 228+229 с новым кодом 502.
  apartment('228', '502', 17, '122.34');

  units.push({
    cadastral_code: code('01', '500'),
    kind: 'TECHNICAL',
    number: '500',
    floor: '',
    floor_label: 'ტექნიკური სართული (ნიშნული 65.10)',
    area_m2: '338.99',
    tariff_category: '',
  });
  for (let n = 1; n <= 47; n++) {
    units.push({
      cadastral_code: code('02', pad(n)),
      kind: 'PARKING',
      number: String(n),
      floor: '-3',
      floor_label: '',
      area_m2: n % 4 === 0 ? '16.25' : '13.75',
      tariff_category: '',
    });
  }
  for (let n = 1; n <= 5; n++) {
    units.push({
      cadastral_code: code('03', pad(n)),
      kind: 'COMMERCIAL',
      number: String(n),
      floor: '1',
      floor_label: '',
      area_m2: area(174.72, 286.72),
      tariff_category: '',
    });
  }
  return units;
}

interface Person {
  key: string;
  name: string;
  ids: string[];
}

export function generateOwners(units: UnitRow[]): {
  rows: OwnerRow[];
  manifest: Manifest['owners'];
} {
  const next = random(7);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  const personalNumber = () => String(Math.floor(10_000_000_000 + next() * 89_999_999_999));
  const passport = () =>
    `${String.fromCharCode(65 + Math.floor(next() * 26))}${String.fromCharCode(65 + Math.floor(next() * 26))}${String(Math.floor(1_000_000 + next() * 8_999_999))}`;

  const rows: OwnerRow[] = [];
  const usedNames = new Set<string>();
  let personCount = 0;
  const newPerson = (): Person => {
    let name: string;
    do {
      name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    } while ([...usedNames].some((used) => similarNames(used, name)));
    usedNames.add(name);
    personCount++;
    // Грузинский личный номер, паспорт или оба; у части собственников номеров нет.
    const variant = next();
    const ids =
      variant < 0.55
        ? [personalNumber()]
        : variant < 0.85
          ? [passport()]
          : variant < 0.95
            ? [personalNumber(), passport()]
            : [];
    return { key: `p${String(personCount).padStart(3, '0')}`, name, ids };
  };
  const add = (
    unit: UnitRow,
    owner: Person,
    kind: OwnerRow['owner_kind'] = 'PERSON',
    extra: Partial<OwnerRow> = {},
  ) =>
    rows.push({
      cadastral_code: unit.cadastral_code,
      owner_key: owner.key,
      owner_kind: kind,
      registry_name: owner.name,
      id_numbers: owner.ids.join('|'),
      share: '',
      share_note: '',
      is_contact: '',
      ...extra,
    });

  const apartments = units.filter((u) => u.kind === 'APARTMENT');
  const parking = units.filter((u) => u.kind === 'PARKING');
  const commercial = units.filter((u) => u.kind === 'COMMERCIAL');
  const technical = units.filter((u) => u.kind === 'TECHNICAL');

  // Застройщик: 8 квартир, 5 машиномест, 2 коммерческих — 15 помещений.
  const developer: Person = {
    key: 'c001',
    name: 'შპს "ბათუმი ჰაითს დეველოპმენტი"',
    ids: ['405123456'],
  };
  const developerUnits = [...apartments.slice(-8), ...parking.slice(-5), ...commercial.slice(0, 2)];
  developerUnits.forEach((unit) => add(unit, developer, 'COMPANY'));
  // Вторая компания — одно коммерческое помещение.
  const company: Person = { key: 'c002', name: 'შპს "ზღვისპირა ვაჭრობა"', ids: ['445987654'] };
  add(commercial[2]!, company, 'COMPANY');

  const ownedByDeveloper = new Set(developerUnits.map((u) => u.cadastral_code));
  const freeApartments = apartments.filter((u) => !ownedByDeveloper.has(u.cadastral_code));
  const freeParking = parking.filter((u) => !ownedByDeveloper.has(u.cadastral_code));

  // Совладельцы: 16 помещений с несколькими собственниками, в 3 — доли.
  const shared = new Set(
    freeApartments
      .filter((_, index) => index % 15 === 7)
      .slice(0, 16)
      .map((u) => u.cadastral_code),
  );
  const shareSets: OwnerRow['share'][][] = [
    ['1/2', '1/2'],
    ['4/6', '1/6', '1/6'],
    ['1/2', '1/4', '1/4'],
  ];
  let sharedIndex = 0;
  const people: Person[] = [];

  for (const unit of freeApartments) {
    if (shared.has(unit.cadastral_code)) {
      const shares = shareSets[sharedIndex] ?? ['', ''];
      sharedIndex++;
      shares.forEach((share, index) => {
        const person = newPerson();
        people.push(person);
        // «Доля внутри доли»: 1/4 совместно двух лиц.
        const note = shares === shareSets[2] && index > 0 ? '1/4 თანასაკუთრებაში' : '';
        add(unit, person, 'PERSON', {
          share,
          share_note: note,
          is_contact: index === 0 ? '1' : '0',
        });
      });
      continue;
    }
    const person = newPerson();
    people.push(person);
    add(unit, person);
  }

  // Часть собственников квартир владеет и машиноместом.
  freeParking.forEach((unit, index) => {
    const person = index % 3 === 0 ? newPerson() : people[(index * 7) % people.length]!;
    add(unit, person);
  });
  const third = newPerson();
  add(commercial[3]!, third);
  add(commercial[4]!, newPerson());
  add(technical[0]!, newPerson());

  // Дубли с другим написанием: то же лицо, но с другим номером документа или без номеров.
  const ambiguous: Record<string, string> = {};
  const duplicateOf = (original: Person, name: string, ids: string[], unit: UnitRow) => {
    personCount++;
    const key = `p${String(personCount).padStart(3, '0')}`;
    add(unit, { key, name, ids });
    ambiguous[key] = `key:${original.key}`;
  };
  const [first, last] = people[10]!.name.split(' ');
  duplicateOf(people[10]!, `${last} ${first}`, [passport()], freeParking[1]!);
  const typo = people[20]!.name.replace(/ი(?=[^ი]*$)/, 'ე');
  duplicateOf(people[20]!, typo, [], freeParking[2]!);

  // Однофамильцы: то же имя, другой человек с другим паспортом.
  personCount++;
  const namesakeKey = `p${String(personCount).padStart(3, '0')}`;
  add(freeParking[4]!, { key: namesakeKey, name: people[30]!.name, ids: [passport()] });
  ambiguous[namesakeKey] = 'new';

  const keys = new Set(rows.map((row) => row.owner_key));
  const duplicates = Object.values(ambiguous).filter((value) => value.startsWith('key:')).length;
  const sampleOwner = people.find(
    (person) =>
      person.ids.length > 0 && rows.filter((r) => r.owner_key === person.key).length === 1,
  )!;
  const sampleRow = rows.find((row) => row.owner_key === sampleOwner.key)!;
  const otherRow = rows.find(
    (row) => row.owner_key !== sampleOwner.key && row.cadastral_code !== sampleRow.cadastral_code,
  )!;

  return {
    rows,
    manifest: {
      rows: rows.length,
      keys: keys.size,
      ambiguous,
      expectedOwners: keys.size - duplicates,
      company: { key: developer.key, units: developerUnits.length },
      sample: {
        ownerKey: sampleOwner.key,
        cadastralCode: sampleRow.cadastral_code,
        otherCadastralCode: otherRow.cadastral_code,
      },
      sampleIdNumber: sampleOwner.ids[0]!,
    },
  };
}

/** CSV с разделителем `;`: поля с `;`, кавычками или переводом строки — в кавычках. */
export function toCsv<T extends object>(rows: T[], columns: (keyof T & string)[]): string {
  const escape = (value: string) =>
    /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return (
    [
      columns.join(';'),
      ...rows.map((row) => columns.map((column) => escape(String(row[column]))).join(';')),
    ].join('\n') + '\n'
  );
}
