import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { UnitDocument } from '@prisma/client';
import { z } from 'zod';
import {
  DOCUMENT_MAX_SIZE,
  DOCUMENT_TYPES,
  SessionUser,
  UnitDocumentItem,
  unitDocumentSchema,
} from '@tsz/shared';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/api-error';
import { isUuid } from '../common/ids';
import { cleanFilename, IncomingFile } from '../documents/documents.service';
import { detectDocumentType } from '../documents/file-type';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { toUnitDocumentItem } from './mappers';
import { UnitAccessService } from './unit-access.service';

type UnitDocumentFields = z.output<typeof unitDocumentSchema>;

/** Документы помещения (ТЗ п. 4.19): видят администраторы и пользователи помещения. */
@Injectable()
export class UnitDocumentsService {
  private readonly logger = new Logger(UnitDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: UnitAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(user: SessionUser, unitId: string): Promise<UnitDocumentItem[]> {
    await this.access.assertCanView(user, unitId);
    const documents = await this.prisma.unitDocument.findMany({
      where: { unitId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return documents.map(toUnitDocumentItem);
  }

  async downloadUrl(
    user: SessionUser,
    unitId: string,
    documentId: string,
    origin: string,
  ): Promise<string> {
    await this.access.assertCanView(user, unitId);
    const document = await this.find(unitId, documentId);
    return this.storage.presignedDownloadUrl(document.storageKey, origin);
  }

  /** Форматы и лимит — как у документов (ТЗ п. 8.6). */
  async upload(
    actor: SessionUser,
    unitId: string,
    input: UnitDocumentFields,
    file: IncomingFile | undefined,
    ip?: string,
  ): Promise<UnitDocumentItem> {
    await this.access.assertCanView(actor, unitId);
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

    const filename = cleanFilename(file.originalname);
    const storageKey = `unit-documents/${randomUUID()}`;
    const mimeType = DOCUMENT_TYPES[type];
    await this.storage.put(storageKey, file.buffer, mimeType, filename);
    let document: UnitDocument;
    try {
      document = await this.prisma.unitDocument.create({
        data: {
          ...input,
          unitId,
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
      action: 'unit_document.upload',
      entity: 'unit',
      entityId: unitId,
      payload: { documentId: document.id, kind: document.kind, filename, fileSize: file.size },
      ip,
    });
    return toUnitDocumentItem(document);
  }

  async remove(actor: SessionUser, unitId: string, documentId: string, ip?: string): Promise<void> {
    const document = await this.find(unitId, documentId);
    await this.prisma.unitDocument.delete({ where: { id: documentId } });
    await this.deleteObject(document.storageKey);
    await this.audit.log({
      userId: actor.id,
      action: 'unit_document.delete',
      entity: 'unit',
      entityId: unitId,
      payload: { documentId, kind: document.kind, filename: document.originalFilename },
      ip,
    });
  }

  private async find(unitId: string, documentId: string): Promise<UnitDocument> {
    const document =
      isUuid(unitId) && isUuid(documentId)
        ? await this.prisma.unitDocument.findFirst({ where: { id: documentId, unitId } })
        : null;
    if (!document) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    }
    return document;
  }

  private async deleteObject(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.error(`Failed to delete storage object ${key}`, error as Error);
    }
  }
}
