import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Unit } from '@prisma/client';
import { z } from 'zod';
import {
  normalizeIdNumber,
  Page,
  searchUnitNumber,
  SessionUser,
  TARIFF_CATEGORIES,
  TariffCategory,
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
import { toUnitItem, unitInclude } from './mappers';
import { OwnerIdsService } from './owner-ids.service';

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

/** Раздел «Помещения» (ТЗ п. 8.1). Операции и баланс — этап 5. */
@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerIds: OwnerIdsService,
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
      conditions.push(owner({ phone: { contains: digits } }));
    }
    return conditions;
  }

  async get(id: string): Promise<UnitItem> {
    return toUnitItem(await this.findWithOwners(id));
  }

  /** Категория тарифа: обязательна для квартир, у остальных видов пустая (ТЗ п. 4.2). */
  async updateCategory(
    actor: SessionUser,
    id: string,
    tariffCategory: TariffCategory | null,
    ip?: string,
  ): Promise<UnitItem> {
    const current = await this.find(id);
    if ((current.kind === 'APARTMENT') !== (tariffCategory !== null)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION', {
        tariffCategory: current.kind === 'APARTMENT' ? 'REQUIRED' : 'INVALID_VALUE',
      });
    }
    if (current.tariffCategory !== tariffCategory) {
      await this.prisma.unit.update({ where: { id }, data: { tariffCategory } });
      await this.audit.log({
        userId: actor.id,
        action: 'unit.category',
        entity: 'unit',
        entityId: id,
        payload: { from: current.tariffCategory, to: tariffCategory },
        ip,
      });
    }
    return this.get(id);
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
}
