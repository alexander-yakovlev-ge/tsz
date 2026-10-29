import { Test } from '@nestjs/testing';
import type { SessionUser } from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UnitAccessService } from '../registry/unit-access.service';
import { StorageService } from '../storage/storage.service';
import { cleanFilename, DocumentsService, visibleTo } from './documents.service';

const CATEGORY_ID = '44444444-4444-4444-8444-444444444444';

const admin: SessionUser = {
  id: '11111111-1111-4111-8111-111111111111',
  phone: '+995555000000',
  name: 'Admin',
  role: 'ADMIN',
  language: 'ru',
};

const fields = {
  titleKa: 'წესდება',
  titleRu: 'Устав',
  titleEn: 'Charter',
  categoryId: CATEGORY_ID,
  visibility: 'PUBLIC' as const,
};

describe('visibleTo', () => {
  it('shows PUBLIC to guests and residents without units, everything to admins', () => {
    expect(visibleTo(undefined, false)).toEqual(['PUBLIC']);
    expect(visibleTo({ ...admin, role: 'RESIDENT' }, false)).toEqual(['PUBLIC']);
    expect(visibleTo(admin, false)).toEqual(['PUBLIC', 'OWNERS', 'PRIVATE']);
  });

  it('adds OWNERS for users of a unit', () => {
    expect(visibleTo({ ...admin, role: 'RESIDENT' }, true)).toEqual(['PUBLIC', 'OWNERS']);
  });
});

describe('cleanFilename', () => {
  it('restores UTF-8 names that busboy read as latin1', () => {
    const raw = Buffer.from('Устав ТСЖ.pdf', 'utf8').toString('latin1');
    expect(cleanFilename(raw)).toBe('Устав ТСЖ.pdf');
  });

  it('drops paths and control characters', () => {
    expect(cleanFilename('..\\..\\evil\n.pdf')).toBe('evil.pdf');
    expect(cleanFilename('')).toBe('file');
  });
});

describe('DocumentsService', () => {
  let service: DocumentsService;
  const prisma = {
    document: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
    documentCategory: { findUnique: jest.fn(), delete: jest.fn() },
  };
  const storage = { put: jest.fn(), delete: jest.fn(), presignedDownloadUrl: jest.fn() };
  const audit = { log: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UnitAccessService, useValue: { hasUnits: jest.fn() } },
        { provide: StorageService, useValue: storage },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(DocumentsService);
  });

  it('rejects an executable renamed to .pdf before touching storage', async () => {
    const file = { originalname: 'report.pdf', size: 4, buffer: Buffer.from('MZ\x90\x00') };
    await expect(service.upload(admin, fields, file)).rejects.toMatchObject({
      response: { statusCode: 415, code: 'FILE_TYPE_NOT_ALLOWED' },
    });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('stores the detected MIME type, not the one from the file name', async () => {
    prisma.documentCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID });
    prisma.document.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'doc', createdAt: new Date(), ...data }),
    );
    const file = { originalname: 'scan.pdf', size: 9, buffer: Buffer.from('%PDF-1.7\n') };
    const document = await service.upload(admin, fields, file);
    expect(document.mimeType).toBe('application/pdf');
    expect(storage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^documents\/[0-9a-f-]{36}$/),
      file.buffer,
      'application/pdf',
      'scan.pdf',
    );
  });

  it('removes the stored file if the database insert fails', async () => {
    prisma.documentCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID });
    prisma.document.create.mockRejectedValue(new Error('db down'));
    const file = { originalname: 'a.pdf', size: 9, buffer: Buffer.from('%PDF-1.7\n') };
    await expect(service.upload(admin, fields, file)).rejects.toThrow('db down');
    expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
  });

  it('refuses to delete a category that still has documents', async () => {
    prisma.documentCategory.findUnique.mockResolvedValue({ id: CATEGORY_ID, nameRu: 'Устав' });
    prisma.document.count.mockResolvedValue(1);
    await expect(service.removeCategory(admin, CATEGORY_ID)).rejects.toMatchObject({
      response: { statusCode: 409, code: 'CATEGORY_NOT_EMPTY' },
    });
    expect(prisma.documentCategory.delete).not.toHaveBeenCalled();
  });

  it('answers 404 for a document the user may not see', async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(
      service.downloadUrl(undefined, CATEGORY_ID, 'https://localhost'),
    ).rejects.toMatchObject({ response: { statusCode: 404 } });
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: CATEGORY_ID, visibility: { in: ['PUBLIC'] } },
    });
    expect(storage.presignedDownloadUrl).not.toHaveBeenCalled();
  });
});
