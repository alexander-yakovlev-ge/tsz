import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import {
  ImportChange,
  ImportIssue,
  ImportIssueCode,
  ImportResult,
  ImportSummary,
  idNumbersField,
  OWNER_KINDS,
  OwnerCandidate,
  OwnerImportGroup,
  OwnerKind,
  OwnerMatch,
  OwnerResolutions,
  OwnershipImportRow,
  OwnersPreview,
  parseShare,
  SessionUser,
  Share,
  UnitFields,
  UnitImportRow,
  unitSchema,
  UnitsPreview,
} from '@tsz/shared';
import { AuditService } from '../../audit/audit.service';
import { ApiError } from '../../common/api-error';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnerIdsService } from '../owner-ids.service';
import { unitChanges, unitData } from '../units.service';
import { CsvError, CsvRow, CsvTable, parseCsv } from './csv';
import { compareNames } from './names';

type Db = Prisma.TransactionClient;

/** Импорты не выполняются параллельно: второй ждёт первого (pg_advisory_xact_lock). */
const IMPORT_LOCK = 4_200_001;

const UNIT_COLUMNS = { required: ['cadastral_code', 'kind', 'number', 'area_m2'] } as const;
const OWNER_COLUMNS = {
  required: ['cadastral_code', 'owner_key', 'owner_kind', 'registry_name'],
} as const;

/** Поле схемы помещения → столбец units.csv. */
const UNIT_FIELD_COLUMNS: Record<string, string> = {
  kind: 'kind',
  cadastralCode: 'cadastral_code',
  number: 'number',
  floor: 'floor',
  floorLabel: 'floor_label',
  areaM2: 'area_m2',
  tariffCategory: 'tariff_category',
};

function issueCode(message: string): ImportIssueCode {
  return message === 'REQUIRED' || message === 'TOO_LONG' ? message : 'INVALID_VALUE';
}

function emptySummary(): ImportSummary {
  return { create: 0, update: 0, unchanged: 0, error: 0 };
}

function count(summary: ImportSummary, action: string): void {
  if (action in summary) {
    summary[action as keyof ImportSummary]++;
  }
}

function readTable(
  buffer: Buffer,
  required: readonly string[],
): { table: CsvTable; fileIssues: ImportIssue[] } {
  let table: CsvTable;
  try {
    table = parseCsv(buffer);
  } catch (error) {
    if (error instanceof CsvError) {
      return { table: { columns: [], rows: [] }, fileIssues: [{ code: 'INVALID_CSV' }] };
    }
    throw error;
  }
  const fileIssues: ImportIssue[] = required
    .filter((column) => !table.columns.includes(column))
    .map((column) => ({ column, code: 'MISSING_COLUMN' as const }));
  if (fileIssues.length === 0 && table.rows.length === 0) {
    fileIssues.push({ code: 'EMPTY_FILE' });
  }
  return { table, fileIssues };
}

function parseBoolean(value: string): boolean | null {
  const text = value.trim().toLowerCase();
  if (['', '0', 'false', 'no', 'нет'].includes(text)) {
    return false;
  }
  if (['1', 'true', 'yes', 'да'].includes(text)) {
    return true;
  }
  return null;
}

function shareText(share: Share | null): string {
  return share ? `${share.num}/${share.den}` : '';
}

// --- Помещения ---

interface UnitPlan {
  preview: UnitsPreview;
  creates: UnitFields[];
  updates: { id: string; input: UnitFields }[];
}

/** Строка units.csv → поля помещения или ошибки по столбцам. */
function parseUnitRow(row: CsvRow): { input?: UnitFields; issues: ImportIssue[] } {
  const v = row.values;
  const issues: ImportIssue[] = [];
  let floor: number | null = null;
  if (v.floor) {
    if (/^-?\d+$/.test(v.floor)) {
      floor = Number(v.floor);
    } else {
      issues.push({ column: 'floor', code: 'INVALID_VALUE' });
    }
  }
  const result = unitSchema.safeParse({
    kind: v.kind?.toUpperCase() || undefined,
    cadastralCode: v.cadastral_code ?? '',
    number: v.number ?? '',
    floor,
    floorLabel: v.floor_label ?? null,
    areaM2: v.area_m2 ?? '',
    tariffCategory: v.tariff_category?.toUpperCase() || null,
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      const column = UNIT_FIELD_COLUMNS[String(issue.path[0])];
      if (!issues.some((existing) => existing.column === column)) {
        issues.push({ column, code: issueCode(issue.message) });
      }
    }
  }
  return issues.length > 0 || !result.success ? { issues } : { input: result.data, issues };
}

async function planUnits(db: Db, buffer: Buffer): Promise<UnitPlan> {
  const { table, fileIssues } = readTable(buffer, UNIT_COLUMNS.required);
  const summary = emptySummary();
  const plan: UnitPlan = {
    preview: { step: 'units', fileIssues, rows: [], summary, ready: false },
    creates: [],
    updates: [],
  };
  if (fileIssues.length > 0) {
    return plan;
  }

  const parsed = table.rows.map((row) => ({ row, ...parseUnitRow(row) }));
  const codes = parsed.flatMap(({ input }) => (input ? [input.cadastralCode] : []));
  const existing = new Map(
    (await db.unit.findMany({ where: { cadastralCode: { in: codes } } })).map((unit) => [
      unit.cadastralCode,
      unit,
    ]),
  );
  const seen = new Set<string>();

  for (const { row, input, issues } of parsed) {
    const code = input?.cadastralCode ?? row.values.cadastral_code ?? '';
    if (input && seen.has(code)) {
      issues.push({ column: 'cadastral_code', code: 'DUPLICATE_ROW' });
    }
    seen.add(code);
    const current = existing.get(code);
    let action: UnitImportRow['action'];
    let changes: ImportChange[] = [];
    if (!input || issues.length > 0) {
      action = 'error';
    } else if (!current) {
      action = 'create';
      plan.creates.push(input);
    } else {
      changes = Object.entries(unitChanges(current, input)).map(([field, change]) => ({
        field,
        ...change,
      }));
      action = changes.length > 0 ? 'update' : 'unchanged';
      if (action === 'update') {
        plan.updates.push({ id: current.id, input });
      }
    }
    count(summary, action);
    plan.preview.rows.push({
      line: row.line,
      cadastralCode: code,
      kind: input?.kind ?? null,
      number: input?.number ?? row.values.number ?? '',
      tariffCategory: input?.tariffCategory ?? null,
      action,
      changes,
      issues,
    });
  }
  plan.preview.ready = summary.error === 0;
  return plan;
}

// --- Собственники ---

interface OwnerRow {
  row: CsvRow;
  key: string;
  kind: OwnerKind | null;
  registryName: string;
  idNumbers: string[];
  unit: Unit | null;
  share: Share | null;
  shareNote: string | null;
  isContact: boolean;
  issues: ImportIssue[];
}

interface Group {
  key: string;
  kind: OwnerKind | null;
  registryName: string;
  idNumbers: string[];
  rows: OwnerRow[];
  error: boolean;
  match: OwnerMatch;
}

interface ExistingOwner {
  id: string;
  kind: OwnerKind;
  registryName: string;
  displayName: string | null;
  idHashes: string[];
  unitIds: Set<string>;
  unitNumbers: string[];
}

interface OwnerPlan {
  preview: OwnersPreview;
  groups: Group[];
  /** Итоговый собственник группы: существующий id или ключ группы, которая его создаст */
  target: Map<string, { ownerId: string } | { createdBy: string }>;
}

function parseOwnerRow(row: CsvRow, units: Map<string, Unit>): OwnerRow {
  const v = row.values;
  const issues: ImportIssue[] = [];
  const require = (column: string, max: number): string => {
    const value = v[column] ?? '';
    if (!value) {
      issues.push({ column, code: 'REQUIRED' });
    } else if (value.length > max) {
      issues.push({ column, code: 'TOO_LONG' });
    }
    return value;
  };
  const key = require('owner_key', 100);
  const registryName = require('registry_name', 300);
  const kindText = (v.owner_kind ?? '').toUpperCase();
  const kind = (OWNER_KINDS as readonly string[]).includes(kindText)
    ? (kindText as OwnerKind)
    : null;
  if (!kind) {
    issues.push({ column: 'owner_kind', code: kindText ? 'INVALID_VALUE' : 'REQUIRED' });
  }
  const code = require('cadastral_code', 64);
  const unit = code ? (units.get(code) ?? null) : null;
  if (code && !unit) {
    issues.push({ column: 'cadastral_code', code: 'UNKNOWN_UNIT' });
  }
  const ids = idNumbersField.safeParse(
    (v.id_numbers ?? '').split('|').filter((value) => value.trim()),
  );
  if (!ids.success) {
    issues.push({ column: 'id_numbers', code: 'INVALID_VALUE' });
  }
  const share = parseShare(v.share ?? '');
  if (share === null) {
    issues.push({ column: 'share', code: 'INVALID_VALUE' });
  }
  const shareNote = v.share_note || null;
  if (shareNote && shareNote.length > 300) {
    issues.push({ column: 'share_note', code: 'TOO_LONG' });
  }
  const isContact = parseBoolean(v.is_contact ?? '');
  if (isContact === null) {
    issues.push({ column: 'is_contact', code: 'INVALID_VALUE' });
  }
  return {
    row,
    key,
    kind,
    registryName,
    idNumbers: ids.success ? ids.data : [],
    unit,
    share: share ?? null,
    shareNote,
    isContact: isContact ?? false,
    issues,
  };
}

function candidateFromOwner(
  owner: ExistingOwner,
  reason: OwnerCandidate['reason'],
): OwnerCandidate {
  return {
    type: 'owner',
    ownerId: owner.id,
    kind: owner.kind,
    registryName: owner.registryName,
    displayName: owner.displayName,
    units: owner.unitNumbers,
    reason,
  };
}

/**
 * Сопоставление с существующими собственниками (ТЗ п. 8.10, v1.10):
 * 1) номер документа; 2) имя — точное однозначное или по уже принадлежащим помещениям;
 * похожие имена, однофамильцы и несколько кандидатов — неоднозначное совпадение.
 */
function matchGroup(
  group: Group,
  owners: ExistingOwner[],
  hash: (n: string) => string,
): OwnerMatch {
  const hashes = new Set(group.idNumbers.map(hash));
  const byId = owners.filter((owner) => owner.idHashes.some((h) => hashes.has(h)));
  if (byId.length === 1) {
    return { status: 'matched', ownerId: byId[0]!.id, by: 'ID_NUMBER' };
  }
  if (byId.length > 1) {
    return {
      status: 'ambiguous',
      candidates: byId.map((owner) => candidateFromOwner(owner, 'ID_NUMBER')),
    };
  }
  const exact: ExistingOwner[] = [];
  const similar: ExistingOwner[] = [];
  for (const owner of owners) {
    const match = compareNames(group.registryName, owner.registryName);
    if (match === 'exact') {
      exact.push(owner);
    } else if (match === 'similar') {
      similar.push(owner);
    }
  }
  const candidates = [...exact, ...similar];
  // Повторный импорт: кандидат уже владеет всеми помещениями из файла — это он.
  const unitIds = group.rows.flatMap((row) => (row.unit ? [row.unit.id] : []));
  const holders =
    unitIds.length > 0
      ? candidates.filter((owner) => unitIds.every((id) => owner.unitIds.has(id)))
      : [];
  if (holders.length === 1) {
    return { status: 'matched', ownerId: holders[0]!.id, by: 'UNITS' };
  }
  const only = exact[0];
  // Однофамильцы: имя совпало, но номера документов у обоих есть и разные.
  const namesakes = only && group.idNumbers.length > 0 && only.idHashes.length > 0;
  if (exact.length === 1 && similar.length === 0 && only && !namesakes) {
    return { status: 'matched', ownerId: only.id, by: 'NAME_EXACT' };
  }
  if (candidates.length > 0) {
    return {
      status: 'ambiguous',
      candidates: [
        ...exact.map((owner) => candidateFromOwner(owner, 'NAME_EXACT')),
        ...similar.map((owner) => candidateFromOwner(owner, 'NAME_SIMILAR')),
      ],
    };
  }
  return { status: 'new' };
}

async function loadOwners(db: Db): Promise<ExistingOwner[]> {
  const owners = await db.owner.findMany({
    include: { ownerships: { include: { unit: true }, orderBy: { unit: { sortKey: 'asc' } } } },
  });
  return owners.map((owner) => ({
    id: owner.id,
    kind: owner.kind,
    registryName: owner.registryName,
    displayName: owner.displayName,
    idHashes: owner.idHashes,
    unitIds: new Set(owner.ownerships.map((ownership) => ownership.unitId)),
    unitNumbers: owner.ownerships.map((ownership) => ownership.unit.number),
  }));
}

async function planOwners(
  db: Db,
  buffer: Buffer,
  resolutions: OwnerResolutions,
  hash: (n: string) => string,
): Promise<OwnerPlan> {
  const { table, fileIssues } = readTable(buffer, OWNER_COLUMNS.required);
  const summary = { ...emptySummary(), newOwners: 0, ambiguous: 0 };
  const plan: OwnerPlan = {
    preview: { step: 'owners', fileIssues, owners: [], rows: [], summary, ready: false },
    groups: [],
    target: new Map(),
  };
  if (fileIssues.length > 0) {
    return plan;
  }

  const codes = table.rows.map((row) => row.values.cadastral_code ?? '').filter(Boolean);
  const units = new Map(
    (await db.unit.findMany({ where: { cadastralCode: { in: codes } } })).map((unit) => [
      unit.cadastralCode,
      unit,
    ]),
  );
  const rows = table.rows.map((row) => parseOwnerRow(row, units));

  // Группы по owner_key: вид и имя одинаковы во всех строках одного лица.
  const groups = new Map<string, Group>();
  for (const row of rows) {
    if (!row.key) {
      continue;
    }
    let group = groups.get(row.key);
    if (!group) {
      group = {
        key: row.key,
        kind: row.kind,
        registryName: row.registryName,
        idNumbers: [],
        rows: [],
        error: false,
        match: { status: 'new' },
      };
      groups.set(row.key, group);
    } else if (
      row.kind !== group.kind ||
      compareNames(row.registryName, group.registryName) !== 'exact'
    ) {
      row.issues.push({ column: 'owner_key', code: 'OWNER_MISMATCH' });
    }
    group.rows.push(row);
    group.idNumbers = [...new Set([...group.idNumbers, ...row.idNumbers])];
  }

  // Один номер документа у разных owner_key — ошибка файла (ТЗ v1.10).
  const idOwner = new Map<string, string>();
  for (const group of groups.values()) {
    for (const number of group.idNumbers) {
      const other = idOwner.get(number);
      if (other && other !== group.key) {
        for (const row of group.rows.filter((r) => r.idNumbers.includes(number))) {
          row.issues.push({ column: 'id_numbers', code: 'ID_NUMBER_SHARED' });
        }
      }
      idOwner.set(number, other ?? group.key);
    }
  }

  // Повторы «помещение + собственник» и несколько контактных лиц одного помещения.
  const pairs = new Set<string>();
  const contacts = new Map<string, OwnerRow[]>();
  for (const row of rows) {
    if (row.unit && row.key) {
      const pair = `${row.unit.id}|${row.key}`;
      if (pairs.has(pair)) {
        row.issues.push({ code: 'DUPLICATE_ROW' });
      }
      pairs.add(pair);
      if (row.isContact) {
        contacts.set(row.unit.id, [...(contacts.get(row.unit.id) ?? []), row]);
      }
    }
  }
  for (const contactRows of contacts.values()) {
    if (contactRows.length > 1) {
      contactRows.forEach((row) =>
        row.issues.push({ column: 'is_contact', code: 'TOO_MANY_CONTACTS' }),
      );
    }
  }

  // Сопоставление с БД, затем похожие имена внутри файла.
  const owners = await loadOwners(db);
  const nameMatchedBy = new Map<string, string>();
  const earlier: Group[] = [];
  for (const group of groups.values()) {
    group.error =
      !group.kind ||
      !group.registryName ||
      group.rows.some((row) =>
        row.issues.some((issue) => ['OWNER_MISMATCH', 'ID_NUMBER_SHARED'].includes(issue.code)),
      );
    if (group.error) {
      group.match = { status: 'error' };
      continue;
    }
    group.match = matchGroup(group, owners, hash);
    if (group.match.status === 'matched' && group.match.by === 'NAME_EXACT') {
      // Две метки файла по имени указывают на одного собственника — решает администратор.
      const first = nameMatchedBy.get(group.match.ownerId);
      if (first) {
        const owner = owners.find((o) => o.id === (group.match as { ownerId: string }).ownerId)!;
        group.match = {
          status: 'ambiguous',
          candidates: [candidateFromOwner(owner, 'NAME_EXACT')],
        };
      } else {
        nameMatchedBy.set(group.match.ownerId, group.key);
      }
    }
    if (group.match.status === 'new' || group.match.status === 'ambiguous') {
      const keyCandidates: OwnerCandidate[] = earlier.flatMap((other) => {
        // Тот же человек в файле дважды или однофамилец — по выписке не различить
        // даже по разным номерам: у одного лица бывают паспорт и личный номер.
        const match = compareNames(group.registryName, other.registryName);
        return match
          ? [
              {
                type: 'key' as const,
                key: other.key,
                registryName: other.registryName,
                reason: match === 'exact' ? ('NAME_EXACT' as const) : ('NAME_SIMILAR' as const),
              },
            ]
          : [];
      });
      if (keyCandidates.length > 0) {
        group.match = {
          status: 'ambiguous',
          candidates: [
            ...(group.match.status === 'ambiguous' ? group.match.candidates : []),
            ...keyCandidates,
          ],
        };
      }
      earlier.push(group);
    }
  }

  // Решения администратора по неоднозначным совпадениям.
  for (const group of groups.values()) {
    if (group.match.status !== 'ambiguous') {
      continue;
    }
    const choice = resolutions[group.key];
    const candidates = group.match.candidates;
    if (choice === 'new') {
      group.match = { status: 'new' };
    } else if (choice?.startsWith('owner:')) {
      const ownerId = choice.slice('owner:'.length);
      if (candidates.some((c) => c.type === 'owner' && c.ownerId === ownerId)) {
        group.match = { status: 'matched', ownerId, by: 'MANUAL' };
      }
    } else if (choice?.startsWith('key:')) {
      const key = choice.slice('key:'.length);
      if (candidates.some((c) => c.type === 'key' && c.key === key)) {
        group.match = { status: 'same_key', key };
      }
    }
  }

  // Итоговый собственник: метка «то же лицо» указывает только на более раннюю — циклов нет.
  const resolve = (group: Group): { ownerId: string } | { createdBy: string } | null => {
    const match = group.match;
    if (match.status === 'matched') {
      return { ownerId: match.ownerId };
    }
    if (match.status === 'new') {
      return { createdBy: group.key };
    }
    if (match.status === 'same_key') {
      const target = groups.get(match.key);
      return target ? resolve(target) : null;
    }
    return null;
  };
  for (const group of groups.values()) {
    const target = resolve(group);
    if (target) {
      plan.target.set(group.key, target);
    }
  }

  // Права собственности: что создастся и что изменится.
  const ownershipList = await db.unitOwnership.findMany({
    where: { unitId: { in: [...units.values()].map((unit) => unit.id) } },
  });
  const ownerships = new Map(ownershipList.map((o) => [`${o.unitId}|${o.ownerId}`, o]));
  const targetPairs = new Set<string>();
  for (const row of rows) {
    const group = groups.get(row.key);
    const target = group ? plan.target.get(group.key) : undefined;
    let action: OwnershipImportRow['action'];
    let changes: ImportChange[] = [];
    if (row.issues.length > 0 || !group || group.error) {
      action = 'error';
    } else if (!target) {
      action = 'pending';
    } else {
      const targetKey = 'ownerId' in target ? target.ownerId : `new:${target.createdBy}`;
      const pair = `${row.unit!.id}|${targetKey}`;
      if (targetPairs.has(pair)) {
        // Две метки одного лица с одним помещением.
        row.issues.push({ code: 'DUPLICATE_ROW' });
        action = 'error';
      } else {
        targetPairs.add(pair);
        const current = 'ownerId' in target ? ownerships.get(pair) : undefined;
        if (!current) {
          action = 'create';
        } else {
          const before = {
            share: shareText(
              current.shareNum ? { num: current.shareNum, den: current.shareDen! } : null,
            ),
            shareNote: current.shareNote ?? '',
            isContact: String(current.isContact),
          };
          const after = {
            share: shareText(row.share),
            shareNote: row.shareNote ?? '',
            isContact: String(row.isContact),
          };
          changes = (Object.keys(before) as (keyof typeof before)[])
            .filter((field) => before[field] !== after[field])
            .map((field) => ({ field, from: before[field], to: after[field] }));
          action = changes.length > 0 ? 'update' : 'unchanged';
        }
      }
    }
    count(summary, action);
    plan.preview.rows.push({
      line: row.row.line,
      key: row.key,
      cadastralCode: row.row.values.cadastral_code ?? '',
      unitNumber: row.unit?.number ?? null,
      share: row.share,
      shareNote: row.shareNote,
      isContact: row.isContact,
      action,
      changes,
      issues: row.issues,
    });
  }

  for (const group of groups.values()) {
    const target = plan.target.get(group.key);
    const matched =
      target && 'ownerId' in target ? owners.find((o) => o.id === target.ownerId) : undefined;
    const known = new Set(matched?.idHashes ?? []);
    if (group.match.status === 'new') {
      summary.newOwners++;
    }
    if (group.match.status === 'ambiguous') {
      summary.ambiguous++;
    }
    plan.preview.owners.push({
      key: group.key,
      kind: group.kind,
      registryName: group.registryName,
      idNumberCount: group.idNumbers.length,
      lines: group.rows.map((row) => row.row.line),
      match: group.match,
      addedIdNumbers: matched ? group.idNumbers.filter((n) => !known.has(hash(n))).length : 0,
    } satisfies OwnerImportGroup);
  }
  plan.groups = [...groups.values()];
  plan.preview.ready = summary.error === 0 && summary.ambiguous === 0;
  return plan;
}

/** Импорт помещений и собственников из CSV выписки (ТЗ п. 8.10). */
@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerIds: OwnerIdsService,
    private readonly audit: AuditService,
  ) {}

  async previewUnits(buffer: Buffer): Promise<UnitsPreview> {
    return (await planUnits(this.prisma, buffer)).preview;
  }

  async previewOwners(buffer: Buffer, resolutions: OwnerResolutions): Promise<OwnersPreview> {
    return (await planOwners(this.prisma, buffer, resolutions, (n) => this.ownerIds.hash(n)))
      .preview;
  }

  /** Проверка повторяется внутри транзакции: применяется ровно то, что прошло проверку. */
  async commitUnits(actor: SessionUser, buffer: Buffer, ip?: string): Promise<ImportResult> {
    const summary = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${IMPORT_LOCK})`;
        const plan = await planUnits(tx, buffer);
        if (!plan.preview.ready) {
          throw new ApiError(HttpStatus.CONFLICT, 'IMPORT_NOT_READY');
        }
        if (plan.creates.length > 0) {
          await tx.unit.createMany({ data: plan.creates.map(unitData) });
        }
        for (const update of plan.updates) {
          await tx.unit.update({ where: { id: update.id }, data: unitData(update.input) });
        }
        return plan.preview.summary;
      },
      { timeout: 60_000 },
    );
    await this.audit.log({
      userId: actor.id,
      action: 'import.units',
      payload: { ...summary },
      ip,
    });
    return { step: 'units', summary };
  }

  async commitOwners(
    actor: SessionUser,
    buffer: Buffer,
    resolutions: OwnerResolutions,
    ip?: string,
  ): Promise<ImportResult> {
    const hash = (n: string) => this.ownerIds.hash(n);
    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${IMPORT_LOCK})`;
        const plan = await planOwners(tx, buffer, resolutions, hash);
        if (!plan.preview.ready) {
          throw new ApiError(HttpStatus.CONFLICT, 'IMPORT_NOT_READY');
        }

        // Новые собственники и новые номера документов у найденных.
        const created = new Map<string, string>();
        let addedIdNumbers = 0;
        for (const group of plan.groups) {
          const target = plan.target.get(group.key)!;
          if ('createdBy' in target && target.createdBy === group.key) {
            const owner = await tx.owner.create({
              data: {
                kind: group.kind!,
                registryName: group.registryName,
                ...this.ownerIds.seal(group.idNumbers),
              },
            });
            created.set(group.key, owner.id);
          }
        }
        const ownerIdOf = (key: string): string => {
          const target = plan.target.get(key)!;
          return 'ownerId' in target ? target.ownerId : created.get(target.createdBy)!;
        };
        const idsByOwner = new Map<string, string[]>();
        for (const group of plan.groups) {
          const target = plan.target.get(group.key)!;
          if ('ownerId' in target || target.createdBy !== group.key) {
            const ownerId = ownerIdOf(group.key);
            idsByOwner.set(ownerId, [...(idsByOwner.get(ownerId) ?? []), ...group.idNumbers]);
          }
        }
        for (const [ownerId, numbers] of idsByOwner) {
          const owner = await tx.owner.findUniqueOrThrow({ where: { id: ownerId } });
          const current = this.ownerIds.open(owner.idNumbers);
          const merged = [...new Set([...current, ...numbers])];
          if (merged.length > current.length) {
            addedIdNumbers += merged.length - current.length;
            await tx.owner.update({ where: { id: ownerId }, data: this.ownerIds.seal(merged) });
          }
        }

        // Права собственности: сначала снимаются отметки контактных лиц, затем записываются строки.
        const rows = plan.preview.rows.filter(
          (row) => row.action === 'create' || row.action === 'update',
        );
        const unitIds = new Map(
          (
            await tx.unit.findMany({
              where: { cadastralCode: { in: rows.map((row) => row.cadastralCode) } },
              select: { id: true, cadastralCode: true },
            })
          ).map((unit) => [unit.cadastralCode, unit.id]),
        );
        for (const row of rows.filter((r) => r.isContact)) {
          await tx.unitOwnership.updateMany({
            where: {
              unitId: unitIds.get(row.cadastralCode)!,
              ownerId: { not: ownerIdOf(row.key) },
            },
            data: { isContact: false },
          });
        }
        for (const row of rows) {
          const unitId = unitIds.get(row.cadastralCode)!;
          const ownerId = ownerIdOf(row.key);
          const data = {
            shareNum: row.share?.num ?? null,
            shareDen: row.share?.den ?? null,
            shareNote: row.shareNote,
            isContact: row.isContact,
          };
          await tx.unitOwnership.upsert({
            where: { unitId_ownerId: { unitId, ownerId } },
            create: { unitId, ownerId, ...data },
            update: data,
          });
        }
        return {
          summary: plan.preview.summary,
          newOwners: created.size,
          addedIdNumbers,
          manual: plan.preview.owners.filter(
            (owner) =>
              (owner.match.status === 'matched' && owner.match.by === 'MANUAL') ||
              owner.match.status === 'same_key',
          ).length,
        };
      },
      { timeout: 60_000 },
    );
    const { summary } = result;
    await this.audit.log({
      userId: actor.id,
      action: 'import.owners',
      payload: {
        ...summary,
        newOwners: result.newOwners,
        addedIdNumbers: result.addedIdNumbers,
        manualResolutions: result.manual,
      },
      ip,
    });
    return {
      step: 'owners',
      summary: {
        create: summary.create,
        update: summary.update,
        unchanged: summary.unchanged,
        error: summary.error,
      },
    };
  }
}
