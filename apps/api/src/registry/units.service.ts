import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, Unit, UnitOwnership } from '@prisma/client';
import { z } from 'zod';
import {
  addOwnershipSchema,
  normalizeIdNumber,
  ownershipSchema,
  Page,
  searchUnitNumber,
  SessionUser,
  TARIFF_CATEGORIES,
  UNIT_KINDS,
  UNIT_PAGE_SIZE,
  UNIT_STATUSES,
  UnitFields,
  UnitItem,
  unitSortKey,
} from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { toUnitItem, unitInclude } from './mappers';
import { OwnerIdsService } from './owner-ids.service';

type OwnershipFields = z.output<typeof ownershipSchema>;
type AddOwnershipFields = z.output<typeof addOwnershipSchema>;

export const unitListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  q: z.string().trim().max(100).optional(),
  kind: z.enum(UNIT_KINDS).optional(),
  category: z.enum(TARIFF_CATEGORIES).optional(),
  status: z.enum(UNIT_STATUSES).default('ACTIVE'),
  /** Ни к одному собственнику не привязана учётная запись (ТЗ п. 8.1) */
  noContact: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
export type UnitListQuery = z.output<typeof unitListQuerySchema>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Поля помещения для БД; sort_key вычисляется из вида и номера. */
export function unitData(input: UnitFields) {
  return { ...input, sortKey: unitSortKey(input.kind, input.number) };
}

/** Изменённые поля помещения для AuditLog и предпросмотра импорта. */
export function unitChanges(
  current: Unit,
  input: UnitFields,
): Record<string, { from: string; to: string }> {
  const changes: Record<string, { from: string; to: string }> = {};
  const before = {
    kind: current.kind,
    number: current.number,
    floor: current.floor?.toString() ?? '',
    floorLabel: current.floorLabel ?? '',
    areaM2: current.areaM2.toFixed(2),
    tariffCategory: current.tariffCategory ?? '',
  };
  const after = {
    kind: input.kind,
    number: input.number,
    floor: input.floor?.toString() ?? '',
    floorLabel: input.floorLabel ?? '',
    areaM2: input.areaM2,
    tariffCategory: input.tariffCategory ?? '',
  };
  for (const field of Object.keys(before) as (keyof typeof before)[]) {
    if (before[field] !== after[field]) {
      changes[field] = { from: before[field], to: after[field] };
    }
  }
  return changes;
}

/** Раздел «Помещения» (ТЗ п. 8.1). Операции, баланс и объединение — этап 5. */
@Injectable()
export class UnitsService {
  private readonly logger = new Logger(UnitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerIds: OwnerIdsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(query: UnitListQuery): Promise<Page<UnitItem>> {
    const where: Prisma.UnitWhereInput = {
      status: query.status,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.category ? { tariffCategory: query.category } : {}),
      ...(query.noContact
        ? { ownerships: { none: { owner: { user: { deletedAt: null } } } } }
        : {}),
      ...(query.q ? { OR: this.searchConditions(query.q) } : {}),
    };
    const [total, units] = await this.prisma.$transaction([
      this.prisma.unit.count({ where }),
      this.prisma.unit.findMany({
        where,
        include: unitInclude,
        orderBy: [{ sortKey: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * UNIT_PAGE_SIZE,
        take: UNIT_PAGE_SIZE,
      }),
    ]);
    return {
      items: units.map(toUnitItem),
      page: query.page,
      pageCount: Math.max(1, Math.ceil(total / UNIT_PAGE_SIZE)),
      total,
    };
  }

  /** Номер помещения, кадастровый код, имя собственника (оба написания), телефон, номер документа. */
  private searchConditions(q: string): Prisma.UnitWhereInput[] {
    const owner = (where: Prisma.OwnerWhereInput): Prisma.UnitWhereInput => ({
      ownerships: { some: { owner: where } },
    });
    const conditions: Prisma.UnitWhereInput[] = [
      { number: searchUnitNumber(q) },
      { cadastralCode: { contains: q } },
      owner({ registryName: { contains: q, mode: 'insensitive' } }),
      owner({ displayName: { contains: q, mode: 'insensitive' } }),
      owner({ idHashes: { has: this.ownerIds.hash(normalizeIdNumber(q)) } }),
    ];
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 4) {
      conditions.push(owner({ user: { phone: { contains: digits }, deletedAt: null } }));
    }
    return conditions;
  }

  async get(id: string): Promise<UnitItem> {
    return toUnitItem(await this.findWithOwners(id));
  }

  async create(actor: SessionUser, input: UnitFields, ip?: string): Promise<UnitItem> {
    const unit = await this.prisma.unit
      .create({ data: unitData(input), include: unitInclude })
      .catch((error: unknown) => {
        throw isUniqueViolation(error)
          ? new ApiError(HttpStatus.CONFLICT, 'CADASTRAL_CODE_TAKEN')
          : error;
      });
    await this.audit.log({
      userId: actor.id,
      action: 'unit.create',
      entity: 'unit',
      entityId: unit.id,
      payload: { cadastralCode: unit.cadastralCode, kind: unit.kind, number: unit.number },
      ip,
    });
    return toUnitItem(unit);
  }

  async update(actor: SessionUser, id: string, input: UnitFields, ip?: string): Promise<UnitItem> {
    const current = await this.find(id);
    const changes = unitChanges(current, input);
    if (current.cadastralCode !== input.cadastralCode) {
      changes.cadastralCode = { from: current.cadastralCode, to: input.cadastralCode };
    }
    const unit = await this.prisma.unit
      .update({ where: { id }, data: unitData(input), include: unitInclude })
      .catch((error: unknown) => {
        throw isUniqueViolation(error)
          ? new ApiError(HttpStatus.CONFLICT, 'CADASTRAL_CODE_TAKEN')
          : error;
      });
    if (Object.keys(changes).length > 0) {
      await this.audit.log({
        userId: actor.id,
        action: 'unit.update',
        entity: 'unit',
        entityId: id,
        payload: changes,
        ip,
      });
    }
    return toUnitItem(unit);
  }

  /**
   * Удаление (ТЗ п. 8.1): права собственности удаляются вместе с помещением, документы — из хранилища.
   * Запрет удаления при наличии операций появится вместе с операциями на этапе 5.
   */
  async remove(actor: SessionUser, id: string, ip?: string): Promise<void> {
    const unit = await this.find(id);
    const documents = await this.prisma.unitDocument.findMany({ where: { unitId: id } });
    await this.prisma.$transaction([
      this.prisma.unitDocument.deleteMany({ where: { unitId: id } }),
      this.prisma.unit.delete({ where: { id } }),
    ]);
    for (const document of documents) {
      await this.storage.delete(document.storageKey).catch((error: unknown) => {
        this.logger.error(`Failed to delete storage object ${document.storageKey}`, error as Error);
      });
    }
    await this.audit.log({
      userId: actor.id,
      action: 'unit.delete',
      entity: 'unit',
      entityId: id,
      payload: { cadastralCode: unit.cadastralCode, number: unit.number },
      ip,
    });
  }

  // --- Собственники помещения ---

  async addOwnership(
    actor: SessionUser,
    unitId: string,
    input: AddOwnershipFields,
    ip?: string,
  ): Promise<UnitItem> {
    await this.find(unitId);
    if (
      !(await this.prisma.owner.findUnique({ where: { id: input.ownerId }, select: { id: true } }))
    ) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION', { ownerId: 'INVALID_VALUE' });
    }
    const ownership = await this.prisma
      .$transaction(async (tx) => {
        if (input.isContact) {
          await tx.unitOwnership.updateMany({ where: { unitId }, data: { isContact: false } });
        }
        return tx.unitOwnership.create({
          data: {
            unitId,
            ownerId: input.ownerId,
            ...shareData(input),
          },
        });
      })
      .catch((error: unknown) => {
        throw isUniqueViolation(error)
          ? new ApiError(HttpStatus.CONFLICT, 'OWNERSHIP_EXISTS')
          : error;
      });
    await this.audit.log({
      userId: actor.id,
      action: 'unit.ownership_add',
      entity: 'unit',
      entityId: unitId,
      payload: { ownerId: input.ownerId, ...ownershipPayload(ownership) },
      ip,
    });
    return this.get(unitId);
  }

  async updateOwnership(
    actor: SessionUser,
    unitId: string,
    ownershipId: string,
    input: OwnershipFields,
    ip?: string,
  ): Promise<UnitItem> {
    const current = await this.findOwnership(unitId, ownershipId);
    const ownership = await this.prisma.$transaction(async (tx) => {
      if (input.isContact) {
        await tx.unitOwnership.updateMany({
          where: { unitId, id: { not: ownershipId } },
          data: { isContact: false },
        });
      }
      return tx.unitOwnership.update({ where: { id: ownershipId }, data: shareData(input) });
    });
    await this.audit.log({
      userId: actor.id,
      action: 'unit.ownership_update',
      entity: 'unit',
      entityId: unitId,
      payload: {
        ownerId: current.ownerId,
        from: ownershipPayload(current),
        to: ownershipPayload(ownership),
      },
      ip,
    });
    return this.get(unitId);
  }

  /** Отвязка собственника: его пользователи теряют доступ к помещению (ТЗ п. 8.1). */
  async removeOwnership(
    actor: SessionUser,
    unitId: string,
    ownershipId: string,
    ip?: string,
  ): Promise<UnitItem> {
    const current = await this.findOwnership(unitId, ownershipId);
    await this.prisma.unitOwnership.delete({ where: { id: ownershipId } });
    await this.audit.log({
      userId: actor.id,
      action: 'unit.ownership_remove',
      entity: 'unit',
      entityId: unitId,
      payload: { ownerId: current.ownerId, ...ownershipPayload(current) },
      ip,
    });
    return this.get(unitId);
  }

  async find(id: string): Promise<Unit> {
    const unit = isUuid(id) ? await this.prisma.unit.findUnique({ where: { id } }) : null;
    if (!unit) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return unit;
  }

  private async findWithOwners(id: string) {
    const unit = isUuid(id)
      ? await this.prisma.unit.findUnique({ where: { id }, include: unitInclude })
      : null;
    if (!unit) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return unit;
  }

  private async findOwnership(unitId: string, ownershipId: string): Promise<UnitOwnership> {
    const ownership =
      isUuid(unitId) && isUuid(ownershipId)
        ? await this.prisma.unitOwnership.findFirst({ where: { id: ownershipId, unitId } })
        : null;
    if (!ownership) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return ownership;
  }
}

export function shareData(input: OwnershipFields) {
  return {
    shareNum: input.share?.num ?? null,
    shareDen: input.share?.den ?? null,
    shareNote: input.shareNote,
    isContact: input.isContact,
  };
}

function ownershipPayload(ownership: UnitOwnership) {
  return {
    share: ownership.shareNum ? `${ownership.shareNum}/${ownership.shareDen}` : null,
    shareNote: ownership.shareNote,
    isContact: ownership.isContact,
  };
}
