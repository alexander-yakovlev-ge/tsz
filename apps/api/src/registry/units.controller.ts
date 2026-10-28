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
  addOwnershipSchema,
  DOCUMENT_MAX_SIZE,
  ownershipSchema,
  Page,
  SessionUser,
  UnitDocumentItem,
  unitDocumentSchema,
  UnitFields,
  UnitItem,
  unitSchema,
} from '@tsz/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import type { IncomingFile } from '../documents/documents.service';
import { FileTooLargeFilter } from '../documents/file-too-large.filter';
import { UnitDocumentsService } from './unit-documents.service';
import { UnitListQuery, unitListQuerySchema, UnitsService } from './units.service';

/** Помещения и их документы (ТЗ п. 8.1, 9). Документы помещения видят и его пользователи. */
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

  @Post()
  @Roles('ADMIN')
  async create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(unitSchema)) body: UnitFields,
    @Req() req: Request,
  ): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.create(actor, body, req.ip) };
  }

  @Get(':id')
  @Roles('ADMIN')
  async get(@Param('id') id: string): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.get(id) };
  }

  @Put(':id')
  @Roles('ADMIN')
  async update(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(unitSchema)) body: UnitFields,
    @Req() req: Request,
  ): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.update(actor, id, body, req.ip) };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) {
    return this.units.remove(actor, id, req.ip);
  }

  @Post(':id/ownerships')
  @Roles('ADMIN')
  async addOwnership(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(addOwnershipSchema)) body: z.output<typeof addOwnershipSchema>,
    @Req() req: Request,
  ): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.addOwnership(actor, id, body, req.ip) };
  }

  @Put(':id/ownerships/:ownershipId')
  @Roles('ADMIN')
  async updateOwnership(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Param('ownershipId') ownershipId: string,
    @Body(new ZodPipe(ownershipSchema)) body: z.output<typeof ownershipSchema>,
    @Req() req: Request,
  ): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.updateOwnership(actor, id, ownershipId, body, req.ip) };
  }

  @Delete(':id/ownerships/:ownershipId')
  @Roles('ADMIN')
  async removeOwnership(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Param('ownershipId') ownershipId: string,
    @Req() req: Request,
  ): Promise<{ unit: UnitItem }> {
    return { unit: await this.units.removeOwnership(actor, id, ownershipId, req.ip) };
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
