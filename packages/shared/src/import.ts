import type { OwnerKind, Share, TariffCategory, UnitKind } from './registry';

/**
 * Импорт из выписки (ТЗ п. 8.10): один файл registry.csv, строка — помещение и один его
 * собственник. Учётные записи по телефонам и синхронизация — этап 7.
 */

/** Максимальный размер CSV: в выписке 312 помещений, это десятки килобайт. */
export const IMPORT_MAX_SIZE = 2 * 1024 * 1024;

export const IMPORT_ISSUE_CODES = [
  'INVALID_CSV',
  'EMPTY_FILE',
  'MISSING_COLUMN',
  'REQUIRED',
  'INVALID_VALUE',
  'TOO_LONG',
  'DUPLICATE_ROW',
  /** Данные помещения отличаются от его первой строки в файле */
  'UNIT_MISMATCH',
  /** Ошибка в данных помещения этой строки — право собственности не проверяется */
  'UNIT_ERROR',
  'OWNER_MISMATCH',
  'ID_NUMBER_SHARED',
  'TOO_MANY_CONTACTS',
] as const;
export type ImportIssueCode = (typeof IMPORT_ISSUE_CODES)[number];

export interface ImportIssue {
  /** Столбец CSV; нет — ошибка всей строки или файла */
  column?: string;
  code: ImportIssueCode;
}

/** pending — строка собственника, по которому ещё не решено неоднозначное совпадение */
export type ImportAction = 'create' | 'update' | 'unchanged' | 'error' | 'pending';

export interface ImportChange {
  field: string;
  from: string;
  to: string;
}

export interface ImportSummary {
  create: number;
  update: number;
  unchanged: number;
  error: number;
}

export interface UnitImportRow {
  /** Номер строки в файле, считая заголовок первой */
  line: number;
  cadastralCode: string;
  kind: UnitKind | null;
  number: string;
  /** Категория тарифа: из файла не берётся — новая квартира получает FULL, дальше вручную */
  tariffCategory: TariffCategory | null;
  action: ImportAction;
  changes: ImportChange[];
  issues: ImportIssue[];
}

/** Почему кандидат предложен: совпал номер документа, имя точно или похоже, или это другая метка файла. */
export type CandidateReason = 'ID_NUMBER' | 'NAME_EXACT' | 'NAME_SIMILAR';

export type OwnerCandidate =
  | {
      type: 'owner';
      ownerId: string;
      kind: OwnerKind;
      registryName: string;
      displayName: string | null;
      /** Номера помещений собственника */
      units: string[];
      reason: CandidateReason;
    }
  | {
      type: 'key';
      key: string;
      registryName: string;
      reason: CandidateReason;
    };

export type OwnerMatch =
  | { status: 'new' }
  | { status: 'matched'; ownerId: string; by: 'ID_NUMBER' | 'NAME_EXACT' | 'UNITS' | 'MANUAL' }
  | { status: 'same_key'; key: string }
  | { status: 'ambiguous'; candidates: OwnerCandidate[] }
  | { status: 'error' };

export interface OwnerImportGroup {
  key: string;
  kind: OwnerKind | null;
  registryName: string;
  idNumberCount: number;
  /** Контактный телефон из файла (E.164); пустой не стирает сохранённый */
  phone: string | null;
  lines: number[];
  match: OwnerMatch;
  /** Новые номера документов, которые добавятся найденному собственнику */
  addedIdNumbers: number;
  /** Изменения у найденного собственника: телефон */
  changes: ImportChange[];
}

export interface OwnershipImportRow {
  line: number;
  key: string;
  cadastralCode: string;
  unitNumber: string | null;
  share: Share | null;
  shareNote: string | null;
  isContact: boolean;
  action: ImportAction;
  changes: ImportChange[];
  issues: ImportIssue[];
}

export interface ImportPreviewSummary {
  units: ImportSummary;
  ownerships: ImportSummary;
  newOwners: number;
  /** Найденные собственники, у которых что-то изменится (телефон, номера документов) */
  ownerUpdates: number;
  ambiguous: number;
}

export interface ImportPreview {
  fileIssues: ImportIssue[];
  units: UnitImportRow[];
  owners: OwnerImportGroup[];
  rows: OwnershipImportRow[];
  summary: ImportPreviewSummary;
  /** Импорт можно выполнить: нет ошибок и все неоднозначные совпадения решены */
  ready: boolean;
}

/**
 * Решения администратора по неоднозначным совпадениям: метка файла →
 * `new` (новый собственник), `owner:<id>` (существующий) или `key:<метка>` (то же лицо, что другая метка).
 */
export type OwnerResolutions = Record<string, string>;

export interface ImportResult {
  summary: ImportPreviewSummary;
}
