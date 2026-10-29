import type { OwnerKind, Share, TariffCategory, UnitKind } from './registry';

/** Импорт из выписки (ТЗ п. 8.10). Контакты и синхронизация — этап 7. */
export const IMPORT_STEPS = ['units', 'owners'] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

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
  'UNKNOWN_UNIT',
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
  tariffCategory: TariffCategory | null;
  action: ImportAction;
  changes: ImportChange[];
  issues: ImportIssue[];
}

export interface UnitsPreview {
  step: 'units';
  fileIssues: ImportIssue[];
  rows: UnitImportRow[];
  summary: ImportSummary;
  /** Импорт можно выполнить: нет ошибок */
  ready: boolean;
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
  lines: number[];
  match: OwnerMatch;
  /** Новые номера документов, которые добавятся найденному собственнику */
  addedIdNumbers: number;
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

export interface OwnersPreview {
  step: 'owners';
  fileIssues: ImportIssue[];
  owners: OwnerImportGroup[];
  rows: OwnershipImportRow[];
  summary: ImportSummary & { newOwners: number; ambiguous: number };
  ready: boolean;
}

export type ImportPreview = UnitsPreview | OwnersPreview;

/**
 * Решения администратора по неоднозначным совпадениям: метка файла →
 * `new` (новый собственник), `owner:<id>` (существующий) или `key:<метка>` (то же лицо, что другая метка).
 */
export type OwnerResolutions = Record<string, string>;

export interface ImportResult {
  step: ImportStep;
  summary: ImportSummary;
}
