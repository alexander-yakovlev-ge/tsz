import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  linkUserSchema,
  mergeOwnerSchema,
  OwnerDetail,
  OwnerFields,
  OwnerItem,
  ownerSchema,
  Page,
  SessionUser,
  TemporaryPasswordResponse,
} from '@tsz/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { OwnerListQuery, ownerListQuerySchema, OwnersService } from './owners.service';

/** Собственники (ТЗ п. 8.12, 9). Только для администраторов: здесь номера документов. */
@Controller('owners')
@Roles('ADMIN')
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get()
  list(@Query(new ZodPipe(ownerListQuerySchema)) query: OwnerListQuery): Promise<Page<OwnerItem>> {
    return this.owners.list(query);
  }

  @Post()
  async create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(ownerSchema)) body: OwnerFields,
    @Req() req: Request,
  ): Promise<{ owner: OwnerDetail }> {
    return { owner: await this.owners.create(actor, body, req.ip) };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<{ owner: OwnerDetail }> {
    return { owner: await this.owners.get(id) };
  }

  @Put(':id')
  async update(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ownerSchema)) body: OwnerFields,
    @Req() req: Request,
  ): Promise<{ owner: OwnerDetail }> {
    return { owner: await this.owners.update(actor, id, body, req.ip) };
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

  @Post(':id/merge')
  async merge(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(mergeOwnerSchema)) body: z.output<typeof mergeOwnerSchema>,
    @Req() req: Request,
  ): Promise<{ owner: OwnerDetail }> {
    return { owner: await this.owners.merge(actor, id, body.duplicateId, req.ip) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) {
    return this.owners.remove(actor, id, req.ip);
  }
}
