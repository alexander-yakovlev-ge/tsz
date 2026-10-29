import { Body, Controller, Get, HttpStatus, Param, Put, Req } from '@nestjs/common';
import { displayNameSchema, MeOwner, MeUnits, ownerName, SessionUser } from '@tsz/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/decorators';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { toShare } from './mappers';
import { unitsOfUser } from './unit-access.service';

function toMeOwner(owner: MeOwner): MeOwner {
  return {
    id: owner.id,
    kind: owner.kind,
    registryName: owner.registryName,
    displayName: owner.displayName,
  };
}

/**
 * Помещения в личном кабинете (ТЗ п. 7.1, 9). Номера документов и телефоны других
 * пользователей в ответ не попадают: совладельцы — только имя и доля.
 */
@Controller('me')
export class MeUnitsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('units')
  async units(@CurrentUser() user: SessionUser): Promise<MeUnits> {
    const [owners, units] = await Promise.all([
      this.prisma.owner.findMany({
        where: { userId: user.id },
        orderBy: [{ kind: 'asc' }, { registryName: 'asc' }],
      }),
      this.prisma.unit.findMany({
        where: unitsOfUser(user.id),
        include: {
          ownerships: {
            include: { owner: true },
            orderBy: [{ isContact: 'desc' }, { owner: { registryName: 'asc' } }],
          },
        },
        orderBy: { sortKey: 'asc' },
      }),
    ]);
    return {
      owners: owners.map(toMeOwner),
      units: units.map((unit) => ({
        id: unit.id,
        kind: unit.kind,
        number: unit.number,
        floor: unit.floor,
        floorLabel: unit.floorLabel,
        areaM2: unit.areaM2.toFixed(2),
        ownerIds: unit.ownerships
          .filter((ownership) => ownership.owner.userId === user.id)
          .map((ownership) => ownership.ownerId),
        owners: unit.ownerships.map((ownership) => ({
          name: ownerName(ownership.owner),
          share: toShare(ownership),
          shareNote: ownership.shareNote,
          isMine: ownership.owner.userId === user.id,
        })),
      })),
    };
  }

  /** Отображаемое имя собственника, к которому привязана учётная запись (ТЗ п. 7.1). */
  @Put('owners/:ownerId/display-name')
  async setDisplayName(
    @CurrentUser() user: SessionUser,
    @Param('ownerId') ownerId: string,
    @Body(new ZodPipe(displayNameSchema)) body: z.output<typeof displayNameSchema>,
    @Req() req: Request,
  ): Promise<{ owner: MeOwner }> {
    const current = isUuid(ownerId)
      ? await this.prisma.owner.findFirst({ where: { id: ownerId, userId: user.id } })
      : null;
    if (!current) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    const owner = await this.prisma.owner.update({
      where: { id: ownerId },
      data: { displayName: body.displayName },
    });
    if (current.displayName !== owner.displayName) {
      await this.audit.log({
        userId: user.id,
        action: 'owner.display_name',
        entity: 'owner',
        entityId: ownerId,
        payload: { from: current.displayName, to: owner.displayName },
        ip: req.ip,
      });
    }
    return { owner: toMeOwner(owner) };
  }
}
