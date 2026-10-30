import { z } from 'zod';
import { code } from './fields';
import type { Locale } from './locales';

// --- Помещения (ТЗ п. 4.2) ---

export const UNIT_KINDS = ['APARTMENT', 'PARKING', 'COMMERCIAL', 'TECHNICAL'] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const TARIFF_CATEGORIES = ['FULL', 'BLACK_FRAME', 'PENSIONER'] as const;
export type TariffCategory = (typeof TARIFF_CATEGORIES)[number];

export const UNIT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** Номер как в реестре: число и, возможно, грузинская буква — «45», «5ა». */
const UNIT_NUMBER = /^(\d{1,5})([ა-ჺ]?)$/;

/** Кадастровый код помещения: 05.30.39.005.01.01.045, номер может оканчиваться буквой — …005ა. */
const CADASTRAL_CODE = /^\d{2}(\.\d{2,3}){6}[ა-ჺ]?$/;

/**
 * Ключ натуральной сортировки (ТЗ п. 4.2): вид, число с ведущими нулями, суффикс.
 * Грузинские буквы в Unicode идут в порядке алфавита: 5, 5ა, 5ბ, 6.
 */
export function unitSortKey(kind: UnitKind, number: string): string {
  const match = UNIT_NUMBER.exec(number);
  const digits = match?.[1] ?? '';
  const suffix = match ? (match[2] ?? '') : number;
  return `${UNIT_KINDS.indexOf(kind) + 1}-${digits.padStart(5, '0')}-${suffix}`;
}

const GEORGIAN_TO_RU: Record<string, string> = {
  ა: 'а',
  ბ: 'б',
  გ: 'г',
  დ: 'д',
  ე: 'е',
  ვ: 'в',
  ზ: 'з',
  თ: 'т',
  ი: 'и',
  კ: 'к',
  ლ: 'л',
  მ: 'м',
  ნ: 'н',
  ო: 'о',
  პ: 'п',
  ჟ: 'ж',
  რ: 'р',
  ს: 'с',
  ტ: 'т',
  უ: 'у',
  ფ: 'ф',
  ქ: 'к',
  ღ: 'г',
  ყ: 'к',
  შ: 'ш',
  ჩ: 'ч',
  ც: 'ц',
  ძ: 'дз',
  წ: 'ц',
  ჭ: 'ч',
  ხ: 'х',
  ჯ: 'дж',
  ჰ: 'х',
};

const GEORGIAN_TO_EN: Record<string, string> = {
  ა: 'a',
  ბ: 'b',
  გ: 'g',
  დ: 'd',
  ე: 'e',
  ვ: 'v',
  ზ: 'z',
  თ: 't',
  ი: 'i',
  კ: 'k',
  ლ: 'l',
  მ: 'm',
  ნ: 'n',
  ო: 'o',
  პ: 'p',
  ჟ: 'zh',
  რ: 'r',
  ს: 's',
  ტ: 't',
  უ: 'u',
  ფ: 'p',
  ქ: 'k',
  ღ: 'gh',
  ყ: 'q',
  შ: 'sh',
  ჩ: 'ch',
  ც: 'ts',
  ძ: 'dz',
  წ: 'ts',
  ჭ: 'ch',
  ხ: 'kh',
  ჯ: 'j',
  ჰ: 'h',
};

/** Номер помещения для отображения: на ru/en грузинская буква транслитерируется — 5ა → 5а / 5a. */
export function displayUnitNumber(number: string, locale: Locale): string {
  if (locale === 'ka') {
    return number;
  }
  const table = locale === 'ru' ? GEORGIAN_TO_RU : GEORGIAN_TO_EN;
  return [...number].map((char) => table[char] ?? char).join('');
}

/**
 * Латинская транслитерация грузинского текста для администратора, не читающего по-грузински:
 * «სალომე ბოლქვაძე» → «Salome Bolkvadze». Без грузинских букв — null.
 */
export function latinName(text: string): string | null {
  if (!/[\u10D0-\u10FF]/.test(text)) {
    return null;
  }
  return text.replace(/[\u10D0-\u10FF]+/g, (word) => {
    const latin = [...word].map((char) => GEORGIAN_TO_EN[char] ?? char).join('');
    return latin.charAt(0).toUpperCase() + latin.slice(1);
  });
}

/** Имя с транслитерацией в скобках для подписей и подтверждений; на ka — как есть. */
export function nameWithLatin(name: string, locale: Locale): string {
  const latin = locale === 'ka' ? null : latinName(name);
  return latin ? `${name} (${latin})` : name;
}

/**
 * Номер для поиска: администратор на ru/en набирает «5а» или «5a» — ищем 5ა.
 * Однозначно обратимы только буквы, которые встречаются в номерах (ა–დ).
 */
export function searchUnitNumber(query: string): string {
  return query
    .trim()
    .replace(/^(\d+)\s*([аa])$/i, '$1ა')
    .replace(/^(\d+)\s*([бb])$/i, '$1ბ')
    .replace(/^(\d+)\s*([гg])$/i, '$1გ')
    .replace(/^(\d+)\s*([дd])$/i, '$1დ');
}

/** Площадь: «38,61» и «38.61» → «38.61». */
const areaField = z
  .union([z.string(code('REQUIRED')), z.number(code('REQUIRED'))], code('REQUIRED'))
  .transform((value, ctx) => {
    const text = String(value).trim().replace(',', '.');
    if (!text) {
      ctx.addIssue({ code: 'custom', message: code('REQUIRED') });
      return z.NEVER;
    }
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
      ctx.addIssue({ code: 'custom', message: code('INVALID_VALUE') });
      return z.NEVER;
    }
    return Number(text).toFixed(2);
  });

const optionalText = (max: number) =>
  z
    .string(code('INVALID_VALUE'))
    .trim()
    .max(max, code('TOO_LONG'))
    .nullish()
    .transform((value) => value || null);

/** Помещение — данные помещения из строки registry.csv (ТЗ п. 8.10). Вручную меняется только категория. */
export const unitSchema = z
  .object({
    kind: z.enum(UNIT_KINDS, code('INVALID_VALUE')),
    cadastralCode: z
      .string(code('REQUIRED'))
      .trim()
      .min(1, code('REQUIRED'))
      .regex(CADASTRAL_CODE, code('INVALID_VALUE')),
    number: z
      .string(code('REQUIRED'))
      .trim()
      .min(1, code('REQUIRED'))
      .regex(UNIT_NUMBER, code('INVALID_VALUE')),
    floor: z
      .number(code('INVALID_VALUE'))
      .int(code('INVALID_VALUE'))
      .min(-10, code('INVALID_VALUE'))
      .max(100, code('INVALID_VALUE'))
      .nullish()
      .transform((value) => value ?? null),
    floorLabel: optionalText(100),
    areaM2: areaField,
    tariffCategory: z
      .enum(TARIFF_CATEGORIES, code('INVALID_VALUE'))
      .nullish()
      .transform((value) => value ?? null),
  })
  .superRefine((unit, ctx) => {
    // Категория обязательна для квартир и не задаётся остальным видам (ТЗ п. 4.2).
    if (unit.kind === 'APARTMENT' && !unit.tariffCategory) {
      ctx.addIssue({ code: 'custom', path: ['tariffCategory'], message: code('REQUIRED') });
    }
    if (unit.kind !== 'APARTMENT' && unit.tariffCategory) {
      ctx.addIssue({ code: 'custom', path: ['tariffCategory'], message: code('INVALID_VALUE') });
    }
  });
export type UnitFields = z.output<typeof unitSchema>;

/** Категория тарифа — единственное поле помещения, которое администратор меняет вручную (ТЗ п. 8.1). */
export const unitCategorySchema = z.object({
  tariffCategory: z
    .enum(TARIFF_CATEGORIES, code('INVALID_VALUE'))
    .nullish()
    .transform((value) => value ?? null),
});
export type UnitCategoryInput = z.input<typeof unitCategorySchema>;

// --- Собственники (ТЗ п. 4.3, 4.3.1) ---

export const OWNER_KINDS = ['PERSON', 'COMPANY'] as const;
export type OwnerKind = (typeof OWNER_KINDS)[number];

/** Номер документа: без пробелов и дефисов, верхний регистр (ТЗ п. 4.3). */
export function normalizeIdNumber(value: string): string {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

const ID_NUMBER = /^[\p{L}\p{N}]{4,32}$/u;

/** Список номеров: нормализованы, без повторов. */
export const idNumbersField = z
  .array(z.string(code('INVALID_VALUE')).max(64, code('TOO_LONG')), code('INVALID_VALUE'))
  .max(20, code('INVALID_VALUE'))
  .default([])
  .transform((values, ctx) => {
    const normalized = [...new Set(values.map(normalizeIdNumber).filter(Boolean))];
    if (normalized.some((value) => !ID_NUMBER.test(value))) {
      ctx.addIssue({ code: 'custom', message: code('INVALID_VALUE') });
      return z.NEVER;
    }
    return normalized;
  });

/**
 * Имя для сравнения: регистр, лишние пробелы и вид кавычек не учитываются
 * (ТЗ v1.10, п. 8.10): «შპს "ალფა"» и «შპს „ალფა“» — одно имя.
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/["'`«»„“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Share {
  num: number;
  den: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Доля «1/2» или «50%» → несократимая дробь; пустая строка — без доли. null — ошибка. */
export function parseShare(value: string): Share | null | undefined {
  const text = value.trim().replace(',', '.');
  if (!text) {
    return undefined;
  }
  let num: number;
  let den: number;
  const fraction = /^(\d{1,4})\s*\/\s*(\d{1,4})$/.exec(text);
  const percent = /^(\d{1,3}(?:\.\d{1,2})?)\s*%$/.exec(text);
  if (fraction) {
    num = Number(fraction[1]);
    den = Number(fraction[2]);
  } else if (percent) {
    num = Math.round(Number(percent[1]) * 100);
    den = 10_000;
  } else {
    return null;
  }
  if (num <= 0 || den <= 0 || num > den) {
    return null;
  }
  const divisor = gcd(num, den);
  return { num: num / divisor, den: den / divisor };
}

export function formatShare(share: Share | null): string {
  return share ? `${share.num}/${share.den}` : '';
}

/** Служебная заметка администратора о собственнике (ТЗ п. 4.3). */
export const ownerNoteSchema = z.object({ note: optionalText(2000) });
export type OwnerNoteInput = z.input<typeof ownerNoteSchema>;

/** Отображаемое имя: пустое — показывается имя из реестра (ТЗ п. 4.3, 7.1). */
export const displayNameSchema = z.object({ displayName: optionalText(200) });
export type DisplayNameInput = z.input<typeof displayNameSchema>;

// --- Ответы API ---

export interface LinkedUser {
  id: string;
  phone: string;
}

/** Собственник помещения в карточке и списке помещений (только ADMIN). */
export interface UnitOwnerItem {
  ownershipId: string;
  ownerId: string;
  ownerKind: OwnerKind;
  registryName: string;
  displayName: string | null;
  /** Контактный телефон из выписки — только для администратора */
  phone: string | null;
  share: Share | null;
  shareNote: string | null;
  isContact: boolean;
  user: LinkedUser | null;
}

export interface UnitItem {
  id: string;
  kind: UnitKind;
  cadastralCode: string;
  number: string;
  floor: number | null;
  floorLabel: string | null;
  areaM2: string;
  tariffCategory: TariffCategory | null;
  status: UnitStatus;
  owners: UnitOwnerItem[];
  /** Хотя бы к одному собственнику привязана учётная запись (ТЗ п. 8.1, «нет контакта») */
  hasContact: boolean;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

export const UNIT_PAGE_SIZE = 50;
export const OWNER_PAGE_SIZE = 50;

export interface OwnerUnitItem {
  ownershipId: string;
  unitId: string;
  kind: UnitKind;
  number: string;
  status: UnitStatus;
  share: Share | null;
  shareNote: string | null;
  isContact: boolean;
}

export interface OwnerItem {
  id: string;
  kind: OwnerKind;
  registryName: string;
  displayName: string | null;
  /** Контактный телефон из registry.csv; учётные записи по нему — этап 7 */
  phone: string | null;
  units: OwnerUnitItem[];
  user: LinkedUser | null;
}

/** Карточка собственника: номера документов видит только администратор (ТЗ п. 4.3). */
export interface OwnerDetail extends OwnerItem {
  idNumbers: string[];
  note: string | null;
}

export const UNIT_DOCUMENT_KINDS = ['REGISTRY_EXTRACT', 'OTHER'] as const;
export type UnitDocumentKind = (typeof UNIT_DOCUMENT_KINDS)[number];

export const unitDocumentSchema = z.object({
  kind: z.enum(UNIT_DOCUMENT_KINDS, code('INVALID_VALUE')),
  title: optionalText(300),
});
export type UnitDocumentInput = z.input<typeof unitDocumentSchema>;

export interface UnitDocumentItem {
  id: string;
  unitId: string;
  kind: UnitDocumentKind;
  title: string | null;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

// --- Личный кабинет (ТЗ п. 7.1, 9) ---

/** Собственник, к которому привязана учётная запись. */
export interface MeOwner {
  id: string;
  kind: OwnerKind;
  registryName: string;
  displayName: string | null;
}

/** Совладелец: без телефонов; свой номер — только у собственников самого пользователя. */
export interface MeUnitOwner {
  name: string;
  share: Share | null;
  shareNote: string | null;
  isMine: boolean;
}

export interface MeUnit {
  id: string;
  kind: UnitKind;
  number: string;
  floor: number | null;
  floorLabel: string | null;
  areaM2: string;
  /** Через каких собственников пользователя доступно помещение — для группировки (ТЗ п. 7.1) */
  ownerIds: string[];
  owners: MeUnitOwner[];
}

export interface MeUnits {
  owners: MeOwner[];
  units: MeUnit[];
}

/** Имя для интерфейса: отображаемое, а если его нет — из реестра (ТЗ п. 4.3). */
export function ownerName(owner: { registryName: string; displayName: string | null }): string {
  return owner.displayName ?? owner.registryName;
}
