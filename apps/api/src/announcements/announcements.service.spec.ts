import { Test } from '@nestjs/testing';
import type { Announcement } from '@prisma/client';
import type { SessionUser } from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { announcementStatus, AnnouncementsService } from './announcements.service';

const ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-01T12:00:00Z');

const actor: SessionUser = {
  id: '11111111-1111-4111-8111-111111111111',
  phone: '+995555000000',
  name: 'Admin',
  role: 'ADMIN',
  language: 'ru',
};

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: ID,
    titleKa: 'ა',
    titleRu: 'А',
    titleEn: 'A',
    bodyKa: 'ტექსტი',
    bodyRu: 'Текст',
    bodyEn: 'Text',
    isPinned: false,
    publishedAt: new Date('2026-10-30T10:00:00Z'),
    archivedAt: null,
    sendPush: false,
    createdBy: actor.id,
    createdAt: new Date('2026-10-30T09:00:00Z'),
    updatedAt: new Date('2026-10-30T09:00:00Z'),
    ...overrides,
  };
}

describe('announcementStatus', () => {
  it('is scheduled until the publication date, then published', () => {
    expect(announcementStatus(announcement({ publishedAt: new Date('2026-11-02') }), NOW)).toBe(
      'SCHEDULED',
    );
    expect(announcementStatus(announcement({ publishedAt: NOW }), NOW)).toBe('PUBLISHED');
  });

  it('is archived regardless of the date', () => {
    expect(announcementStatus(announcement({ archivedAt: NOW }), NOW)).toBe('ARCHIVED');
  });
});

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  const prisma = {
    announcement: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUniqueOrThrow: jest.fn() },
  };
  const audit = { log: jest.fn() };
  const clock = { now: () => NOW };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ClockService, useValue: clock },
      ],
    }).compile();
    service = moduleRef.get(AnnouncementsService);
  });

  it('lists published announcements, pinned first, 20 per page', async () => {
    prisma.announcement.count.mockResolvedValue(45);
    prisma.announcement.findMany.mockResolvedValue([announcement({ isPinned: true })]);
    const page = await service.listPublished(3);
    expect(prisma.announcement.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null, publishedAt: { lte: NOW } },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { id: 'asc' }],
      skip: 40,
      take: 20,
    });
    expect(page).toMatchObject({ page: 3, pageCount: 3, items: [{ status: 'PUBLISHED' }] });
  });

  it('counts announcements published after the last visit as unread', async () => {
    const seenAt = new Date('2026-10-31T00:00:00Z');
    prisma.user.findUniqueOrThrow.mockResolvedValue({ announcementsSeenAt: seenAt });
    prisma.announcement.count.mockResolvedValue(2);
    expect(await service.unreadCount(actor)).toBe(2);
    expect(prisma.announcement.count).toHaveBeenCalledWith({
      where: { archivedAt: null, publishedAt: { lte: NOW, gt: seenAt } },
    });
  });

  it('keeps the original archive date when an archived announcement is edited', async () => {
    const archivedAt = new Date('2026-10-31T08:00:00Z');
    const current = announcement({ archivedAt });
    prisma.announcement.findUnique.mockResolvedValue(current);
    prisma.announcement.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...current, ...data }),
    );
    await service.update(actor, ID, {
      ...current,
      titleRu: 'Новый заголовок',
      publishedAt: current.publishedAt.toISOString(),
      archived: true,
    });
    expect(prisma.announcement.update.mock.calls[0][0].data.archivedAt).toBe(archivedAt);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'announcement.update', payload: { fields: ['titleRu'] } }),
    );
  });

  it('archives and restores an announcement', async () => {
    const current = announcement();
    prisma.announcement.findUnique.mockResolvedValue(current);
    prisma.announcement.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...current, ...data }),
    );
    const input = { ...current, publishedAt: current.publishedAt.toISOString() };
    const archived = await service.update(actor, ID, { ...input, archived: true });
    expect(archived.status).toBe('ARCHIVED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { fields: ['archived'] } }),
    );

    prisma.announcement.findUnique.mockResolvedValue({ ...current, archivedAt: NOW });
    const restored = await service.update(actor, ID, { ...input, archived: false });
    expect(restored.status).toBe('PUBLISHED');
    expect(prisma.announcement.update.mock.calls[1][0].data.archivedAt).toBeNull();
  });

  it('answers 404 for a malformed id', async () => {
    await expect(service.getPublished('42')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});
