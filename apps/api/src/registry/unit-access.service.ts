import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SessionUser } from '@tsz/shared';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Помещения пользователя (ТЗ п. 4.3.1, 7): действующие помещения собственников,
 * к которым привязана его учётная запись. Объединённые доступны только администратору.
 */
export function unitsOfUser(userId: string): Prisma.UnitWhereInput {
  return { status: 'ACTIVE', ownerships: { some: { owner: { userId } } } };
}

@Injectable()
export class UnitAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Документы OWNERS видят пользователи, у которых есть действующее помещение (ТЗ v1.10). */
  async hasUnits(userId: string): Promise<boolean> {
    return (await this.prisma.unit.count({ where: unitsOfUser(userId), take: 1 })) > 0;
  }

  /** Чужое и несуществующее помещение неразличимы: 404 (ТЗ п. 9, IDOR). */
  async assertCanView(user: SessionUser, unitId: string): Promise<void> {
    const where: Prisma.UnitWhereInput =
      user.role === 'ADMIN' ? { id: unitId } : { id: unitId, ...unitsOfUser(user.id) };
    if (!isUuid(unitId) || (await this.prisma.unit.count({ where, take: 1 })) === 0) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
  }
}
