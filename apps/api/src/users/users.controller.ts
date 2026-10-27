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
  Req,
  Res,
} from '@nestjs/common';
import {
  createUserSchema,
  resetPasswordSchema,
  SessionUser,
  TemporaryPasswordResponse,
  updateUserSchema,
  UserListItem,
} from '@tsz/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators';
import { SessionService } from '../auth/session.service';
import { ZodPipe } from '../common/zod.pipe';
import { UsersService } from './users.service';

@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {}

  @Get()
  async list(): Promise<{ users: UserListItem[] }> {
    return { users: await this.users.list() };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<{ user: UserListItem }> {
    return { user: await this.users.get(id) };
  }

  @Post()
  create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(createUserSchema)) body: z.output<typeof createUserSchema>,
    @Req() req: Request,
  ): Promise<{ user: UserListItem } & TemporaryPasswordResponse> {
    return this.users.create(actor, body, req.ip);
  }

  @Put(':id')
  async update(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateUserSchema)) body: z.output<typeof updateUserSchema>,
    @Req() req: Request,
  ): Promise<{ user: UserListItem }> {
    return { user: await this.users.update(actor, id, body, req.ip) };
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(resetPasswordSchema)) body: z.output<typeof resetPasswordSchema>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TemporaryPasswordResponse> {
    const { user, temporaryPassword } = await this.users.resetPassword(
      actor,
      id,
      body.password,
      req.ip,
    );
    // Сброс своего пароля не должен выкидывать самого администратора.
    if (user.id === actor.id) {
      await this.sessions.issue(res, user);
    }
    return temporaryPassword ? { temporaryPassword } : {};
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.users.remove(actor, id, req.ip);
  }
}
