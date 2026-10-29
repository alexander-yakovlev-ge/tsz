import { Test } from '@nestjs/testing';
import type { User } from '@prisma/client';
import type { SessionUser } from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const actor: SessionUser = {
  id: ADMIN_ID,
  phone: '+995555000000',
  name: 'Admin',
  role: 'ADMIN',
  language: 'ru',
};

function user(overrides: Partial<User> = {}): User {
  return {
    id: OTHER_ID,
    phone: '+995555111111',
    passwordHash: 'hash',
    role: 'ADMIN',
    name: 'Other',
    language: 'ka',
    notifyAnnouncements: true,
    notifyBalance: true,
    tokenVersion: 0,
    announcementsSeenAt: null,
    deletedAt: null,
    createdAt: new Date('2026-10-28T00:00:00Z'),
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  const prisma = {
    user: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    owner: { updateMany: jest.fn() },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const audit = { log: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('forbids deleting yourself', async () => {
    await expect(service.remove(actor, ADMIN_ID)).rejects.toMatchObject({
      response: { code: 'CANNOT_DELETE_SELF' },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('forbids removing your own admin role', async () => {
    prisma.user.findFirst.mockResolvedValue(user({ id: ADMIN_ID, phone: actor.phone }));
    await expect(
      service.update(actor, ADMIN_ID, {
        phone: actor.phone,
        name: 'Admin',
        role: 'RESIDENT',
        language: 'ru',
      }),
    ).rejects.toMatchObject({ response: { code: 'CANNOT_DEMOTE_SELF' } });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ends the sessions of a user whose role changes', async () => {
    const current = user();
    prisma.user.findFirst.mockResolvedValue(current);
    prisma.user.update.mockResolvedValue({
      ...current,
      role: 'RESIDENT',
      tokenVersion: 1,
      owners: [],
    });
    await service.update(actor, OTHER_ID, {
      phone: current.phone,
      name: 'Other',
      role: 'RESIDENT',
      language: 'ka',
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.update',
        payload: { role: { from: 'ADMIN', to: 'RESIDENT' } },
      }),
    );
  });

  it('keeps sessions when only the name changes', async () => {
    const current = user();
    prisma.user.findFirst.mockResolvedValue(current);
    prisma.user.update.mockResolvedValue({ ...current, name: 'New', owners: [] });
    await service.update(actor, OTHER_ID, {
      phone: current.phone,
      name: 'New',
      role: 'ADMIN',
      language: 'ka',
    });
    expect(prisma.user.update.mock.calls[0][0].data.tokenVersion).toBeUndefined();
  });

  it('generates a temporary password on reset and ends sessions', async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ ...user(), ...data }));
    const result = await service.resetPassword(actor, OTHER_ID, undefined);
    expect(result.temporaryPassword).toMatch(/^[a-zA-Z2-9]{12}$/);
    expect(prisma.user.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.reset_password', payload: { generated: true } }),
    );
  });

  it('soft-deletes, ends sessions and unlinks owners', async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    prisma.owner.updateMany.mockResolvedValue({ count: 2 });
    await service.remove(actor, OTHER_ID);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.tokenVersion).toEqual({ increment: 1 });
    expect(prisma.owner.updateMany).toHaveBeenCalledWith({
      where: { userId: OTHER_ID },
      data: { userId: null },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { phone: '+995555111111', unlinkedOwners: 2 } }),
    );
  });

  it('answers 404 for a malformed id without querying the database', async () => {
    await expect(service.get('not-a-uuid')).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
