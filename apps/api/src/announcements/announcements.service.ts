import { HttpStatus, Injectable } from '@nestjs/common';
import { Announcement, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  announcementSchema,
  AnnouncementItem,
  AnnouncementPage,
  ANNOUNCEMENTS_PAGE_SIZE,
  AnnouncementStatus,
  SessionUser,
  updateAnnouncementSchema,
} from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../clock/clock.service';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { PrismaService } from '../prisma/prisma.service';

type CreateAnnouncement = z.output<typeof announcementSchema>;
type UpdateAnnouncement = z.output<typeof updateAnnouncementSchema>;

/** Сначала закреплённые, затем по дате публикации, новые первыми (ТЗ п. 6.1). */
const PUBLIC_ORDER: Prisma.AnnouncementOrderByWithRelationInput[] = [
  { isPinned: 'desc' },
  { publishedAt: 'desc' },
  { id: 'asc' },
];

export function announcementStatus(announcement: Announcement, now: Date): AnnouncementStatus {
  if (announcement.archivedAt) {
    return 'ARCHIVED';
  }
  return announcement.publishedAt > now ? 'SCHEDULED' : 'PUBLISHED';
}

/** Опубликовано, если published_at ≤ now и archived_at IS NULL (ТЗ п. 4.10). */
export function publishedWhere(now: Date): Prisma.AnnouncementWhereInput {
  return { archivedAt: null, publishedAt: { lte: now } };
}

/** Объявления (ТЗ п. 6.1, 8.5). Push при публикации появится на этапе 6. */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  async listPublished(page: number, pageSize = ANNOUNCEMENTS_PAGE_SIZE): Promise<AnnouncementPage> {
    const now = this.clock.now();
    const where = publishedWhere(now);
    const [total, announcements] = await Promise.all([
      this.prisma.announcement.count({ where }),
      this.prisma.announcement.findMany({
        where,
        orderBy: PUBLIC_ORDER,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: announcements.map((announcement) => this.toItem(announcement, now)),
      page,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getPublished(id: string): Promise<AnnouncementItem> {
    const now = this.clock.now();
    const announcement = isUuid(id)
      ? await this.prisma.announcement.findFirst({ where: { id, ...publishedWhere(now) } })
      : null;
    if (!announcement) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return this.toItem(announcement, now);
  }

  /** Пользователь открыл список объявлений: бейдж непрочитанных гаснет (ТЗ п. 6.1). */
  async markSeen(user: SessionUser): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { announcementsSeenAt: this.clock.now() },
    });
  }

  /** Опубликованные после последнего просмотра списка (ТЗ п. 6.2). */
  async unreadCount(user: SessionUser): Promise<number> {
    const now = this.clock.now();
    const { announcementsSeenAt } = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { announcementsSeenAt: true },
    });
    return this.prisma.announcement.count({
      where: {
        archivedAt: null,
        publishedAt: { lte: now, ...(announcementsSeenAt ? { gt: announcementsSeenAt } : {}) },
      },
    });
  }

  async listAll(): Promise<AnnouncementItem[]> {
    const now = this.clock.now();
    const announcements = await this.prisma.announcement.findMany({
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
    });
    return announcements.map((announcement) => this.toItem(announcement, now));
  }

  async get(id: string): Promise<AnnouncementItem> {
    return this.toItem(await this.find(id), this.clock.now());
  }

  async create(
    actor: SessionUser,
    input: CreateAnnouncement,
    ip?: string,
  ): Promise<AnnouncementItem> {
    const announcement = await this.prisma.announcement.create({
      data: { ...input, publishedAt: new Date(input.publishedAt), createdBy: actor.id },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'announcement.create',
      entity: 'announcement',
      entityId: announcement.id,
      payload: {
        titleRu: announcement.titleRu,
        publishedAt: announcement.publishedAt.toISOString(),
        isPinned: announcement.isPinned,
      },
      ip,
    });
    return this.toItem(announcement, this.clock.now());
  }

  async update(
    actor: SessionUser,
    id: string,
    { archived, ...input }: UpdateAnnouncement,
    ip?: string,
  ): Promise<AnnouncementItem> {
    const current = await this.find(id);
    const now = this.clock.now();
    const publishedAt = new Date(input.publishedAt);
    const archivedAt = archived ? (current.archivedAt ?? now) : null;

    const fields: string[] = (Object.keys(input) as (keyof typeof input)[]).filter(
      (key) => key !== 'publishedAt' && current[key] !== input[key],
    );
    if (current.publishedAt.getTime() !== publishedAt.getTime()) {
      fields.push('publishedAt');
    }
    if (Boolean(current.archivedAt) !== archived) {
      fields.push('archived');
    }

    const announcement = await this.prisma.announcement.update({
      where: { id },
      data: { ...input, publishedAt, archivedAt },
    });
    if (fields.length > 0) {
      await this.audit.log({
        userId: actor.id,
        action: 'announcement.update',
        entity: 'announcement',
        entityId: id,
        payload: { fields },
        ip,
      });
    }
    return this.toItem(announcement, now);
  }

  async remove(actor: SessionUser, id: string, ip?: string): Promise<void> {
    const announcement = await this.find(id);
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.log({
      userId: actor.id,
      action: 'announcement.delete',
      entity: 'announcement',
      entityId: id,
      payload: { titleRu: announcement.titleRu },
      ip,
    });
  }

  private async find(id: string): Promise<Announcement> {
    const announcement = isUuid(id)
      ? await this.prisma.announcement.findUnique({ where: { id } })
      : null;
    if (!announcement) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return announcement;
  }

  private toItem(announcement: Announcement, now: Date): AnnouncementItem {
    return {
      id: announcement.id,
      titleKa: announcement.titleKa,
      titleRu: announcement.titleRu,
      titleEn: announcement.titleEn,
      bodyKa: announcement.bodyKa,
      bodyRu: announcement.bodyRu,
      bodyEn: announcement.bodyEn,
      isPinned: announcement.isPinned,
      publishedAt: announcement.publishedAt.toISOString(),
      archivedAt: announcement.archivedAt?.toISOString() ?? null,
      status: announcementStatus(announcement, now),
    };
  }
}
