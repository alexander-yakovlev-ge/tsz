import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { z } from 'zod';
import {
  createUserSchema,
  SessionUser,
  TemporaryPasswordResponse,
  updateUserSchema,
  UserListItem,
} from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { generatePassword, hashPassword } from '../auth/passwords';
import { toSessionUser } from '../auth/session.service';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { PrismaService } from '../prisma/prisma.service';

type CreateUser = z.output<typeof createUserSchema>;
type UpdateUser = z.output<typeof updateUserSchema>;

const userInclude = {
  owners: {
    include: {
      ownerships: {
        where: { unit: { status: 'ACTIVE' } },
        include: { unit: true },
        orderBy: { unit: { sortKey: 'asc' } },
      },
    },
    orderBy: { registryName: 'asc' },
  },
} satisfies Prisma.UserInclude;
type UserWithOwners = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function toListItem(user: UserWithOwners): UserListItem {
  return {
    ...toSessionUser(user),
    createdAt: user.createdAt.toISOString(),
    owners: user.owners.map((owner) => ({
      id: owner.id,
      kind: owner.kind,
      registryName: owner.registryName,
      displayName: owner.displayName,
      units: owner.ownerships.map(({ unit }) => ({
        id: unit.id,
        kind: unit.kind,
        number: unit.number,
      })),
    })),
  };
}

function isPhoneConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Раздел «Пользователи» (ТЗ п. 8.2). */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<UserListItem[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: userInclude,
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toListItem);
  }

  async get(id: string): Promise<UserListItem> {
    await this.findActive(id);
    return toListItem(
      await this.prisma.user.findUniqueOrThrow({ where: { id }, include: userInclude }),
    );
  }

  async create(
    actor: SessionUser,
    input: CreateUser,
    ip?: string,
  ): Promise<{ user: UserListItem } & TemporaryPasswordResponse> {
    await this.assertPhoneFree(input.phone);
    const temporaryPassword = input.password ? undefined : generatePassword();
    const user = await this.prisma.user
      .create({
        data: {
          phone: input.phone,
          name: input.name,
          role: input.role,
          language: input.language,
          passwordHash: await hashPassword(input.password ?? temporaryPassword!),
        },
        include: userInclude,
      })
      .catch((error: unknown) => {
        throw isPhoneConflict(error) ? new ApiError(HttpStatus.CONFLICT, 'PHONE_TAKEN') : error;
      });
    await this.audit.log({
      userId: actor.id,
      action: 'user.create',
      entity: 'user',
      entityId: user.id,
      payload: { phone: user.phone, name: user.name, role: user.role, language: user.language },
      ip,
    });
    return { user: toListItem(user), ...(temporaryPassword ? { temporaryPassword } : {}) };
  }

  /** Смена роли увеличивает token_version: сессии пользователя завершаются сразу. */
  async update(
    actor: SessionUser,
    id: string,
    input: UpdateUser,
    ip?: string,
  ): Promise<UserListItem> {
    const current = await this.findActive(id);
    if (current.id === actor.id && input.role !== 'ADMIN') {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'CANNOT_DEMOTE_SELF');
    }
    if (input.phone !== current.phone) {
      await this.assertPhoneFree(input.phone);
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of ['phone', 'name', 'role', 'language'] as const) {
      if (current[field] !== input[field]) {
        changes[field] = { from: current[field], to: input[field] };
      }
    }

    const user = await this.prisma.user
      .update({
        where: { id },
        data: {
          ...input,
          ...(changes.role ? { tokenVersion: { increment: 1 } } : {}),
        },
        include: userInclude,
      })
      .catch((error: unknown) => {
        throw isPhoneConflict(error) ? new ApiError(HttpStatus.CONFLICT, 'PHONE_TAKEN') : error;
      });
    if (Object.keys(changes).length > 0) {
      await this.audit.log({
        userId: actor.id,
        action: 'user.update',
        entity: 'user',
        entityId: id,
        payload: changes as Prisma.InputJsonValue,
        ip,
      });
    }
    return toListItem(user);
  }

  /** Сброс пароля: все сессии пользователя завершаются. */
  async resetPassword(
    actor: SessionUser,
    id: string,
    password: string | undefined,
    ip?: string,
  ): Promise<{ user: User } & TemporaryPasswordResponse> {
    await this.findActive(id);
    const temporaryPassword = password ? undefined : generatePassword();
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password ?? temporaryPassword!),
        tokenVersion: { increment: 1 },
      },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'user.reset_password',
      entity: 'user',
      entityId: id,
      payload: { generated: !password },
      ip,
    });
    return { user, ...(temporaryPassword ? { temporaryPassword } : {}) };
  }

  /**
   * Мягкое удаление (ТЗ п. 8.2): учётная запись отвязывается от собственников, их права
   * на помещения сохраняются. Push-подписки появятся на этапе 6.
   */
  async remove(actor: SessionUser, id: string, ip?: string): Promise<void> {
    if (id === actor.id) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'CANNOT_DELETE_SELF');
    }
    const user = await this.findActive(id);
    const [unlinked] = await this.prisma.$transaction([
      this.prisma.owner.updateMany({ where: { userId: id }, data: { userId: null } }),
      this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), tokenVersion: { increment: 1 } },
      }),
    ]);
    await this.audit.log({
      userId: actor.id,
      action: 'user.delete',
      entity: 'user',
      entityId: id,
      payload: { phone: user.phone, unlinkedOwners: unlinked.count },
      ip,
    });
  }

  private async findActive(id: string): Promise<User> {
    const user = isUuid(id)
      ? await this.prisma.user.findFirst({ where: { id, deletedAt: null } })
      : null;
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return user;
  }

  private async assertPhoneFree(phone: string): Promise<void> {
    if (
      await this.prisma.user.findFirst({ where: { phone, deletedAt: null }, select: { id: true } })
    ) {
      throw new ApiError(HttpStatus.CONFLICT, 'PHONE_TAKEN');
    }
  }
}
