import { Body, Controller, Delete, Get, Param, Put, Query, Req } from '@nestjs/common';
import {
  linkUserSchema,
  OwnerDetail,
  OwnerItem,
  ownerNoteSchema,
  Page,
  SessionUser,
  TemporaryPasswordResponse,
} from '@tsz/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { OwnerListQuery, ownerListQuerySchema, OwnersService } from './owners.service';

/**
 * Собственники (ТЗ п. 8.12, 9). Только для администраторов: здесь номера документов.
 * Собственников создаёт и меняет только импорт; вручную — заметка и учётная запись.
 */
@Controller('owners')
@Roles('ADMIN')
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get()
  list(@Query(new ZodPipe(ownerListQuerySchema)) query: OwnerListQuery): Promise<Page<OwnerItem>> {
    return this.owners.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<{ owner: OwnerDetail }> {
    return { owner: await this.owners.get(id) };
  }

  @Put(':id/note')
  async updateNote(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ownerNoteSchema)) body: z.output<typeof ownerNoteSchema>,
    @Req() req: Request,
  ): Promise<{ owner: OwnerDetail }> {
    return { owner: await this.owners.updateNote(actor, id, body.note, req.ip) };
  }

  @Put(':id/user')
  linkUser(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(linkUserSchema)) body: z.output<typeof linkUserSchema>,
    @Req() req: Request,
  ): Promise<{ owner: OwnerDetail } & TemporaryPasswordResponse> {
    return this.owners.linkUser(actor, id, body, req.ip);
  }

  @Delete(':id/user')
  async unlinkUser(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ owner: OwnerDetail }> {
    return { owner: await this.owners.unlinkUser(actor, id, req.ip) };
  }
}
