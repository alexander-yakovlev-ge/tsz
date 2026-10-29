import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Document, DocumentCategory, DocumentVisibility, Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  DOCUMENT_MAX_SIZE,
  DOCUMENT_TYPES,
  DocumentCategoryItem,
  documentCategorySchema,
  DocumentItem,
  documentSchema,
  SessionUser,
} from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { PrismaService } from '../prisma/prisma.service';
import { UnitAccessService } from '../registry/unit-access.service';
import { StorageService } from '../storage/storage.service';
import { detectDocumentType } from './file-type';

type DocumentFields = z.output<typeof documentSchema>;
type CategoryFields = z.output<typeof documentCategorySchema>;

export interface IncomingFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/**
 * Какие документы видит пользователь (ТЗ п. 4.9, 6.3): гость — PUBLIC, администратор — все,
 * пользователь с действующим помещением — ещё и OWNERS (ТЗ v1.10).
 */
export function visibleTo(user: SessionUser | undefined, hasUnits: boolean): DocumentVisibility[] {
  if (user?.role === 'ADMIN') {
    return ['PUBLIC', 'OWNERS', 'PRIVATE'];
  }
  return user && hasUnits ? ['PUBLIC', 'OWNERS'] : ['PUBLIC'];
}

/**
 * Имя файла из multipart. Busboy читает его как latin1, хотя браузеры шлют UTF-8;
 * путь и управляющие символы отбрасываются.
 */
export function cleanFilename(raw: string): string {
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  // eslint-disable-next-line no-control-regex
  const name = path.basename(utf8.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '');
  return name.slice(-200) || 'file';
}

function toItem(document: Document): DocumentItem {
  return {
    id: document.id,
    titleKa: document.titleKa,
    titleRu: document.titleRu,
    titleEn: document.titleEn,
    categoryId: document.categoryId,
    visibility: document.visibility,
    originalFilename: document.originalFilename,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    createdAt: document.createdAt.toISOString(),
  };
}

function toCategoryItem(
  category: DocumentCategory & { _count: { documents: number } },
): DocumentCategoryItem {
  return {
    id: category.id,
    nameKa: category.nameKa,
    nameRu: category.nameRu,
    nameEn: category.nameEn,
    sortOrder: category.sortOrder,
    documentCount: category._count.documents,
  };
}

/** Документы и их категории (ТЗ п. 6.3, 8.6). */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: UnitAccessService,
    private readonly audit: AuditService,
  ) {}

  private async visibility(user: SessionUser | undefined): Promise<DocumentVisibility[]> {
    const hasUnits = user?.role === 'RESIDENT' ? await this.access.hasUnits(user.id) : false;
    return visibleTo(user, hasUnits);
  }

  // --- Категории ---

  /** Число документов — только видимых пользователю. */
  async listCategories(user: SessionUser | undefined): Promise<DocumentCategoryItem[]> {
    const visibility = await this.visibility(user);
    const categories = await this.prisma.documentCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { documents: { where: { visibility: { in: visibility } } } } },
      },
    });
    return categories.map(toCategoryItem);
  }

  async createCategory(
    actor: SessionUser,
    input: CategoryFields,
    ip?: string,
  ): Promise<DocumentCategoryItem> {
    const category = await this.prisma.documentCategory.create({
      data: input,
      include: { _count: { select: { documents: true } } },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'document_category.create',
      entity: 'document_category',
      entityId: category.id,
      payload: input,
      ip,
    });
    return toCategoryItem(category);
  }

  async updateCategory(
    actor: SessionUser,
    id: string,
    input: CategoryFields,
    ip?: string,
  ): Promise<DocumentCategoryItem> {
    await this.findCategory(id);
    const category = await this.prisma.documentCategory.update({
      where: { id },
      data: input,
      include: { _count: { select: { documents: true } } },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'document_category.update',
      entity: 'document_category',
      entityId: id,
      payload: input,
      ip,
    });
    return toCategoryItem(category);
  }

  /** Удалить можно только пустую категорию (ТЗ п. 4.8). */
  async removeCategory(actor: SessionUser, id: string, ip?: string): Promise<void> {
    const category = await this.findCategory(id);
    if ((await this.prisma.document.count({ where: { categoryId: id } })) > 0) {
      throw new ApiError(HttpStatus.CONFLICT, 'CATEGORY_NOT_EMPTY');
    }
    await this.prisma.documentCategory.delete({ where: { id } }).catch((error: unknown) => {
      // Документ мог появиться между проверкой и удалением — внешний ключ не даст удалить.
      throw error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
        ? new ApiError(HttpStatus.CONFLICT, 'CATEGORY_NOT_EMPTY')
        : error;
    });
    await this.audit.log({
      userId: actor.id,
      action: 'document_category.delete',
      entity: 'document_category',
      entityId: id,
      payload: { nameRu: category.nameRu },
      ip,
    });
  }

  // --- Документы ---

  /** Внутри категории — новые первыми (ТЗ п. 6.3). */
  async list(user: SessionUser | undefined): Promise<DocumentItem[]> {
    const documents = await this.prisma.document.findMany({
      where: { visibility: { in: await this.visibility(user) } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return documents.map(toItem);
  }

  async get(user: SessionUser | undefined, id: string): Promise<DocumentItem> {
    return toItem(await this.findVisible(user, id));
  }

  /** Presigned URL после проверки доступа; нет доступа — 404, как и несуществующий (ТЗ п. 6.3). */
  async downloadUrl(user: SessionUser | undefined, id: string, origin: string): Promise<string> {
    const document = await this.findVisible(user, id);
    return this.storage.presignedDownloadUrl(document.storageKey, origin);
  }

  async upload(
    actor: SessionUser,
    input: DocumentFields,
    file: IncomingFile | undefined,
    ip?: string,
  ): Promise<DocumentItem> {
    if (!file || file.size === 0) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED');
    }
    if (file.size > DOCUMENT_MAX_SIZE) {
      throw new ApiError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE');
    }
    const type = detectDocumentType(file.buffer);
    if (!type) {
      throw new ApiError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'FILE_TYPE_NOT_ALLOWED');
    }
    await this.assertCategoryExists(input.categoryId);

    const filename = cleanFilename(file.originalname);
    const storageKey = `documents/${randomUUID()}`;
    const mimeType = DOCUMENT_TYPES[type];
    await this.storage.put(storageKey, file.buffer, mimeType, filename);
    let document: Document;
    try {
      document = await this.prisma.document.create({
        data: {
          ...input,
          storageKey,
          originalFilename: filename,
          fileSize: file.size,
          mimeType,
          uploadedBy: actor.id,
        },
      });
    } catch (error) {
      await this.deleteObject(storageKey);
      throw error;
    }
    await this.audit.log({
      userId: actor.id,
      action: 'document.upload',
      entity: 'document',
      entityId: document.id,
      payload: {
        titleRu: document.titleRu,
        visibility: document.visibility,
        filename,
        fileSize: file.size,
      },
      ip,
    });
    return toItem(document);
  }

  /** Заголовок, категория и доступ — без повторной загрузки файла (ТЗ п. 8.6). */
  async update(
    actor: SessionUser,
    id: string,
    input: DocumentFields,
    ip?: string,
  ): Promise<DocumentItem> {
    const current = await this.find(id);
    await this.assertCategoryExists(input.categoryId);
    const changes: Record<string, { from: string; to: string }> = {};
    for (const field of ['titleKa', 'titleRu', 'titleEn', 'categoryId', 'visibility'] as const) {
      if (current[field] !== input[field]) {
        changes[field] = { from: current[field], to: input[field] };
      }
    }
    const document = await this.prisma.document.update({ where: { id }, data: input });
    if (Object.keys(changes).length > 0) {
      await this.audit.log({
        userId: actor.id,
        action: 'document.update',
        entity: 'document',
        entityId: id,
        payload: changes,
        ip,
      });
    }
    return toItem(document);
  }

  /** Файл удаляется из хранилища вместе с документом (ТЗ п. 8.6). */
  async remove(actor: SessionUser, id: string, ip?: string): Promise<void> {
    const document = await this.find(id);
    await this.prisma.document.delete({ where: { id } });
    await this.deleteObject(document.storageKey);
    await this.audit.log({
      userId: actor.id,
      action: 'document.delete',
      entity: 'document',
      entityId: id,
      payload: { titleRu: document.titleRu, filename: document.originalFilename },
      ip,
    });
  }

  private async find(id: string): Promise<Document> {
    const document = isUuid(id) ? await this.prisma.document.findUnique({ where: { id } }) : null;
    if (!document) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return document;
  }

  private async findVisible(user: SessionUser | undefined, id: string): Promise<Document> {
    const document = isUuid(id)
      ? await this.prisma.document.findFirst({
          where: { id, visibility: { in: await this.visibility(user) } },
        })
      : null;
    if (!document) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return document;
  }

  private async findCategory(id: string): Promise<DocumentCategory> {
    const category = isUuid(id)
      ? await this.prisma.documentCategory.findUnique({ where: { id } })
      : null;
    if (!category) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return category;
  }

  private async assertCategoryExists(id: string): Promise<void> {
    if (!(await this.prisma.documentCategory.findUnique({ where: { id }, select: { id: true } }))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION', { categoryId: 'INVALID_VALUE' });
    }
  }

  /** Сбой удаления файла не откатывает операцию: «осиротевший» объект виден в логах. */
  private async deleteObject(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.error(`Failed to delete storage object ${key}`, error as Error);
    }
  }
}
