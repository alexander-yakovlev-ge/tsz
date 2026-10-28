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
  announcementSchema,
  AnnouncementItem,
  AnnouncementPage,
  SessionUser,
  updateAnnouncementSchema,
} from '@tsz/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AnnouncementsService } from './announcements.service';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  /** Страница «Объявления» отмечает их прочитанными; главная — нет */
  markSeen: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** Главная показывает 3 последних (ТЗ v1.9) */
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

/** Объявления (ТЗ п. 6.1, 8.5, 9). */
@Controller()
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('announcements')
  @Public()
  async listPublished(
    @CurrentUser() user: SessionUser | undefined,
    @Query(new ZodPipe(listQuerySchema)) query: z.output<typeof listQuerySchema>,
  ): Promise<AnnouncementPage> {
    const page = await this.announcements.listPublished(query.page, query.limit);
    if (query.markSeen && user) {
      await this.announcements.markSeen(user);
    }
    return page;
  }

  @Get('announcements/:id')
  @Public()
  async getPublished(@Param('id') id: string): Promise<{ announcement: AnnouncementItem }> {
    return { announcement: await this.announcements.getPublished(id) };
  }

  @Get('me/announcements/unread')
  async unread(@CurrentUser() user: SessionUser): Promise<{ count: number }> {
    return { count: await this.announcements.unreadCount(user) };
  }

  @Get('admin/announcements')
  @Roles('ADMIN')
  async listAll(): Promise<{ announcements: AnnouncementItem[] }> {
    return { announcements: await this.announcements.listAll() };
  }

  @Get('admin/announcements/:id')
  @Roles('ADMIN')
  async get(@Param('id') id: string): Promise<{ announcement: AnnouncementItem }> {
    return { announcement: await this.announcements.get(id) };
  }

  @Post('announcements')
  @Roles('ADMIN')
  async create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(announcementSchema)) body: z.output<typeof announcementSchema>,
    @Req() req: Request,
  ): Promise<{ announcement: AnnouncementItem }> {
    return { announcement: await this.announcements.create(actor, body, req.ip) };
  }

  @Put('announcements/:id')
  @Roles('ADMIN')
  async update(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateAnnouncementSchema)) body: z.output<typeof updateAnnouncementSchema>,
    @Req() req: Request,
  ): Promise<{ announcement: AnnouncementItem }> {
    return { announcement: await this.announcements.update(actor, id, body, req.ip) };
  }

  @Delete('announcements/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.announcements.remove(actor, id, req.ip);
  }
}
