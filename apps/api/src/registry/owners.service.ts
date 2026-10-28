import { HttpStatus, Injectable } from '@nestjs/common';
import { Owner, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  linkUserSchema,
  normalizeIdNumber,
  OWNER_KINDS,
  OWNER_PAGE_SIZE,
  OwnerDetail,
  OwnerFields,
  OwnerItem,
  Page,
  searchUnitNumber,
  SessionUser,
  TemporaryPasswordResponse,
} from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { generatePassword, hashPassword } from '../auth/passwords';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { PrismaService } from '../prisma/prisma.service';
import { ownerInclude, OwnerWithUnits, toOwnerItem } from './mappers';
import { OwnerIdsService } from './owner-ids.service';

type LinkUser = z.output<typeof linkUserSchema>;

export const ownerListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  q: z.string().trim().max(100).optional(),
  kind: z.enum(OWNER_KINDS).optional(),
  /** Без учётной записи */
  noUser: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Без помещений — бывшие собственники (ТЗ п. 8.12) */
  noUnits: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
export type OwnerListQuery = z.output<typeof ownerListQuerySchema>;

const activeUser = { deletedAt: null } satisfies Prisma.UserWhereInput;

/** Раздел «Собственники» (ТЗ п. 8.12). */
@Injectable()
export class OwnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownerIds: OwnerIdsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: OwnerListQuery): Promise<Page<OwnerItem>> {
    const where: Prisma.OwnerWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.noUser ? { OR: [{ userId: null }, { user: { deletedAt: { not: null } } }] } : {}),
      ...(query.noUnits ? { ownerships: { none: {} } } : {}),
      ...(query.q ? { AND: [{ OR: this.searchConditions(query.q) }] } : {}),
    };
    const [total, owners] = await this.prisma.$transaction([
      this.prisma.owner.count({ where }),
      this.prisma.owner.findMany({
        where,
        include: ownerInclude,
        orderBy: [{ registryName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * OWNER_PAGE_SIZE,
        take: OWNER_PAGE_SIZE,
      }),
    ]);
    return {
      items: owners.map(toOwnerItem),
      page: query.page,
      pageCount: Math.max(1, Math.ceil(total / OWNER_PAGE_SIZE)),
      total,
    };
  }

  /** Имя (оба написания), номер документа, номер помещения, телефон (ТЗ п. 8.12). */
  private searchConditions(q: string): Prisma.OwnerWhereInput[] {
    const conditions: Prisma.OwnerWhereInput[] = [
      { registryName: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
      { idHashes: { has: this.ownerIds.hash(normalizeIdNumber(q)) } },
      { ownerships: { some: { unit: { number: searchUnitNumber(q) } } } },
    ];
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 4) {
      conditions.push({ user: { phone: { contains: digits }, ...activeUser } });
    }
    return conditions;
  }

  async get(id: string): Promise<OwnerDetail> {
    return this.toDetail(await this.findWithUnits(id));
  }

  async create(actor: SessionUser, input: OwnerFields, ip?: string): Promise<OwnerDetail> {
    const { idNumbers, ...fields } = input;
    const owner = await this.prisma.owner.create({
      data: { ...fields, ...this.ownerIds.seal(idNumbers) },
      include: ownerInclude,
    });
    await this.audit.log({
      userId: actor.id,
      action: 'owner.create',
      entity: 'owner',
      entityId: owner.id,
      payload: { kind: owner.kind, registryName: owner.registryName, idNumbers: idNumbers.length },
      ip,
    });
    return this.toDetail(owner);
  }

  /** Номера документов в AuditLog не пишутся — только их число (ТЗ п. 4.3). */
  async update(
    actor: SessionUser,
    id: string,
    input: OwnerFields,
    ip?: string,
  ): Promise<OwnerDetail> {
    const current = await this.find(id);
    const currentIds = this.ownerIds.open(current.idNumbers);
    const changes: Record<string, unknown> = {};
    for (const field of ['kind', 'registryName', 'displayName', 'note'] as const) {
      if (current[field] !== input[field]) {
        changes[field] = field === 'note' ? true : { from: current[field], to: input[field] };
      }
    }
    const idsChanged =
      currentIds.length !== input.idNumbers.length ||
      currentIds.some((value, index) => value !== input.idNumbers[index]);
    if (idsChanged) {
      changes.idNumbers = { from: currentIds.length, to: input.idNumbers.length };
    }
    const { idNumbers, ...fields } = input;
    const owner = await this.prisma.owner.update({
      where: { id },
      data: { ...fields, ...(idsChanged ? this.ownerIds.seal(idNumbers) : {}) },
      include: ownerInclude,
    });
    if (Object.keys(changes).length > 0) {
      await this.audit.log({
        userId: actor.id,
        action: 'owner.update',
        entity: 'owner',
        entityId: id,
        payload: changes as Prisma.InputJsonValue,
        ip,
      });
    }
    return this.toDetail(owner);
  }

  /**
   * Привязка учётной записи (ТЗ п. 8.12): существующей или новой RESIDENT.
   * У собственника одна учётная запись — новая заменяет прежнюю.
   */
  async linkUser(
    actor: SessionUser,
    id: string,
    input: LinkUser,
    ip?: string,
  ): Promise<{ owner: OwnerDetail } & TemporaryPasswordResponse> {
    const current = await this.find(id);
    let userId: string;
    let temporaryPassword: string | undefined;
    if (input.mode === 'existing') {
      const user = await this.prisma.user.findFirst({ where: { id: input.userId, ...activeUser } });
      if (!user) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'USER_NOT_FOUND');
      }
      userId = user.id;
    } else {
      if (await this.prisma.user.findFirst({ where: { phone: input.phone, ...activeUser } })) {
        throw new ApiError(HttpStatus.CONFLICT, 'PHONE_TAKEN');
      }
      temporaryPassword = input.password ? undefined : generatePassword();
      const user = await this.prisma.user
        .create({
          data: {
            phone: input.phone,
            role: 'RESIDENT',
            language: input.language,
            passwordHash: await hashPassword(input.password ?? temporaryPassword!),
          },
        })
        .catch((error: unknown) => {
          throw error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
            ? new ApiError(HttpStatus.CONFLICT, 'PHONE_TAKEN')
            : error;
        });
      userId = user.id;
      await this.audit.log({
        userId: actor.id,
        action: 'user.create',
        entity: 'user',
        entityId: user.id,
        payload: { phone: user.phone, role: user.role, language: user.language, ownerId: id },
        ip,
      });
    }
    const owner = await this.prisma.owner.update({
      where: { id },
      data: { userId },
      include: ownerInclude,
    });
    await this.audit.log({
      userId: actor.id,
      action: 'owner.link_user',
      entity: 'owner',
      entityId: id,
      payload: { from: current.userId, to: userId },
      ip,
    });
    return { owner: this.toDetail(owner), ...(temporaryPassword ? { temporaryPassword } : {}) };
  }

  async unlinkUser(actor: SessionUser, id: string, ip?: string): Promise<OwnerDetail> {
    const current = await this.find(id);
    const owner = await this.prisma.owner.update({
      where: { id },
      data: { userId: null },
      include: ownerInclude,
    });
    if (current.userId) {
      await this.audit.log({
        userId: actor.id,
        action: 'owner.unlink_user',
        entity: 'owner',
        entityId: id,
        payload: { userId: current.userId },
        ip,
      });
    }
    return this.toDetail(owner);
  }

  /**
   * Слияние дублей (ТЗ п. 8.12): права на помещения, номера документов и учётная запись
   * переходят на основную запись, дубль удаляется. Если оба владеют одним помещением,
   * остаётся право основной записи, отметка контактного лица сохраняется.
   */
  async merge(
    actor: SessionUser,
    id: string,
    duplicateId: string,
    ip?: string,
  ): Promise<OwnerDetail> {
    if (id === duplicateId) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'OWNER_MERGE_SELF');
    }
    const primary = await this.find(id);
    const duplicate = await this.prisma.owner.findUnique({
      where: { id: duplicateId },
      include: { ownerships: true },
    });
    if (!duplicate) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION', { duplicateId: 'INVALID_VALUE' });
    }
    const idNumbers = [
      ...new Set([
        ...this.ownerIds.open(primary.idNumbers),
        ...this.ownerIds.open(duplicate.idNumbers),
      ]),
    ];
    let movedUnits = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const ownership of duplicate.ownerships) {
        const existing = await tx.unitOwnership.findUnique({
          where: { unitId_ownerId: { unitId: ownership.unitId, ownerId: id } },
        });
        if (existing) {
          await tx.unitOwnership.delete({ where: { id: ownership.id } });
          if (ownership.isContact && !existing.isContact) {
            await tx.unitOwnership.update({
              where: { id: existing.id },
              data: { isContact: true },
            });
          }
        } else {
          await tx.unitOwnership.update({ where: { id: ownership.id }, data: { ownerId: id } });
          movedUnits++;
        }
      }
      await tx.owner.update({
        where: { id },
        data: {
          ...this.ownerIds.seal(idNumbers),
          userId: primary.userId ?? duplicate.userId,
          displayName: primary.displayName ?? duplicate.displayName,
          note: [primary.note, duplicate.note].filter(Boolean).join('\n\n') || null,
        },
      });
      await tx.owner.delete({ where: { id: duplicateId } });
    });
    await this.audit.log({
      userId: actor.id,
      action: 'owner.merge',
      entity: 'owner',
      entityId: id,
      payload: {
        duplicateId,
        duplicateRegistryName: duplicate.registryName,
        movedUnits,
        userId: primary.userId ? null : duplicate.userId,
      },
      ip,
    });
    return this.get(id);
  }

  /** Только без помещений (ТЗ п. 8.12). */
  async remove(actor: SessionUser, id: string, ip?: string): Promise<void> {
    const owner = await this.find(id);
    if ((await this.prisma.unitOwnership.count({ where: { ownerId: id } })) > 0) {
      throw new ApiError(HttpStatus.CONFLICT, 'OWNER_HAS_UNITS');
    }
    await this.prisma.owner.delete({ where: { id } }).catch((error: unknown) => {
      throw error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
        ? new ApiError(HttpStatus.CONFLICT, 'OWNER_HAS_UNITS')
        : error;
    });
    await this.audit.log({
      userId: actor.id,
      action: 'owner.delete',
      entity: 'owner',
      entityId: id,
      payload: { registryName: owner.registryName },
      ip,
    });
  }

  private toDetail(owner: OwnerWithUnits): OwnerDetail {
    return {
      ...toOwnerItem(owner),
      idNumbers: this.ownerIds.open(owner.idNumbers),
      note: owner.note,
    };
  }

  private async find(id: string): Promise<Owner> {
    const owner = isUuid(id) ? await this.prisma.owner.findUnique({ where: { id } }) : null;
    if (!owner) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return owner;
  }

  private async findWithUnits(id: string): Promise<OwnerWithUnits> {
    const owner = isUuid(id)
      ? await this.prisma.owner.findUnique({ where: { id }, include: ownerInclude })
      : null;
    if (!owner) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return owner;
  }
}
