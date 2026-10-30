import { HttpStatus, Injectable } from '@nestjs/common';
import { Owner, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  linkUserSchema,
  normalizeIdNumber,
  OWNER_KINDS,
  OWNER_PAGE_SIZE,
  OwnerDetail,
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

  /** Имя (оба написания), номер документа, номер помещения, телефон учётной записи или из выписки. */
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
      conditions.push({ phone: { contains: digits } });
    }
    return conditions;
  }

  async get(id: string): Promise<OwnerDetail> {
    return this.toDetail(await this.findWithUnits(id));
  }

  /** Служебная заметка; текст в AuditLog не пишется (ТЗ п. 4.3). */
  async updateNote(
    actor: SessionUser,
    id: string,
    note: string | null,
    ip?: string,
  ): Promise<OwnerDetail> {
    const current = await this.find(id);
    if (current.note === note) {
      return this.get(id);
    }
    const owner = await this.prisma.owner.update({
      where: { id },
      data: { note },
      include: ownerInclude,
    });
    await this.audit.log({
      userId: actor.id,
      action: 'owner.note',
      entity: 'owner',
      entityId: id,
      payload: { note: note !== null },
      ip,
    });
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
