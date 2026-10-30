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
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  DOCUMENT_MAX_SIZE,
  Page,
  SessionUser,
  unitCategorySchema,
  UnitDocumentItem,
  unitDocumentSchema,
  UnitItem,
} from '@tsz/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import type { IncomingFile } from '../documents/documents.service';
import { FileTooLargeFilter } from '../documents/file-too-large.filter';
import { UnitDocumentsService } from './unit-documents.service';
import { UnitListQuery, unitListQuerySchema, UnitsService } from './units.service';

/**
 * Помещения и их документы (ТЗ п. 8.1, 9). Помещения и собственников меняет только импорт
 * и синхронизация с выпиской; вручную — категория тарифа и документы.
 * Документы помещения видят и его пользователи.
 */
@Controller('units')
export class UnitsController {
  constructor(
    private readonly units: UnitsService,
    private readonly documents: UnitDocumentsService,
  ) {}

  @Get()
  @Roles('ADMIN')
  list(@Query(new ZodPipe(unitListQuerySchema)) query: UnitListQuery): Promise<Page<UnitItem>> {
    return this.units.list(query);
  }

  @Get(':id')
  @Roles('ADMIN')
  async get(@Param('id') id: string): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.get(id) };
  }

  @Put(':id/category')
  @Roles('ADMIN')
  async updateCategory(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(unitCategorySchema)) body: z.output<typeof unitCategorySchema>,
    @Req() req: Request,
  ): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.updateCategory(actor, id, body.tariffCategory, req.ip) };
  }

  // --- Документы помещения (ТЗ п. 4.19) ---

  @Get(':id/documents')
  async listDocuments(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
  ): Promise<{ documents: UnitDocumentItem[] }> {
    return { documents: await this.documents.list(user, id) };
  }

  @Get(':id/documents/:documentId/download')
  async download(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.documents.downloadUrl(
      user,
      id,
      documentId,
      `${req.protocol}://${req.get('host')}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(HttpStatus.FOUND, url);
  }

  @Post(':id/documents')
  @Roles('ADMIN')
  @UseFilters(FileTooLargeFilter)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: DOCUMENT_MAX_SIZE, files: 1, fields: 10 } }),
  )
  async upload(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(unitDocumentSchema)) body: z.output<typeof unitDocumentSchema>,
    @UploadedFile() file: IncomingFile | undefined,
    @Req() req: Request,
  ): Promise<{ document: UnitDocumentItem }> {
    return { document: await this.documents.upload(actor, id, body, file, req.ip) };
  }

  @Delete(':id/documents/:documentId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.documents.remove(actor, id, documentId, req.ip);
  }
}
