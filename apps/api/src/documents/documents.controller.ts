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
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  DOCUMENT_MAX_SIZE,
  DocumentCategoryItem,
  documentCategorySchema,
  DocumentItem,
  documentSchema,
  SessionUser,
} from '@tsz/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { DocumentsService, IncomingFile } from './documents.service';
import { FileTooLargeFilter } from './file-too-large.filter';

/** Документы и категории (ТЗ п. 6.3, 8.6, 9). */
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('document-categories')
  @Public()
  async listCategories(
    @CurrentUser() user: SessionUser | undefined,
  ): Promise<{ categories: DocumentCategoryItem[] }> {
    return { categories: await this.documents.listCategories(user) };
  }

  @Post('document-categories')
  @Roles('ADMIN')
  async createCategory(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(documentCategorySchema)) body: z.output<typeof documentCategorySchema>,
    @Req() req: Request,
  ): Promise<{ category: DocumentCategoryItem }> {
    return { category: await this.documents.createCategory(actor, body, req.ip) };
  }

  @Put('document-categories/:id')
  @Roles('ADMIN')
  async updateCategory(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(documentCategorySchema)) body: z.output<typeof documentCategorySchema>,
    @Req() req: Request,
  ): Promise<{ category: DocumentCategoryItem }> {
    return { category: await this.documents.updateCategory(actor, id, body, req.ip) };
  }

  @Delete('document-categories/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCategory(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.documents.removeCategory(actor, id, req.ip);
  }

  @Get('documents')
  @Public()
  async list(@CurrentUser() user: SessionUser | undefined): Promise<{ documents: DocumentItem[] }> {
    return { documents: await this.documents.list(user) };
  }

  @Get('documents/:id')
  @Public()
  async get(
    @CurrentUser() user: SessionUser | undefined,
    @Param('id') id: string,
  ): Promise<{ document: DocumentItem }> {
    return { document: await this.documents.get(user, id) };
  }

  /** Ссылка подписывается на адрес сайта, с которого пришёл запрос (Caddy передаёт Host). */
  @Get('documents/:id/download')
  @Public()
  async download(
    @CurrentUser() user: SessionUser | undefined,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.documents.downloadUrl(user, id, `${req.protocol}://${req.get('host')}`);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(HttpStatus.FOUND, url);
  }

  @Post('documents')
  @Roles('ADMIN')
  @UseFilters(FileTooLargeFilter)
  @UseInterceptors(
    // Без dest multer держит файл в памяти: он проверяется по содержимому до записи в хранилище.
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_MAX_SIZE, files: 1, fields: 20 },
    }),
  )
  async upload(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(documentSchema)) body: z.output<typeof documentSchema>,
    @UploadedFile() file: IncomingFile | undefined,
    @Req() req: Request,
  ): Promise<{ document: DocumentItem }> {
    return { document: await this.documents.upload(actor, body, file, req.ip) };
  }

  @Put('documents/:id')
  @Roles('ADMIN')
  async update(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(documentSchema)) body: z.output<typeof documentSchema>,
    @Req() req: Request,
  ): Promise<{ document: DocumentItem }> {
    return { document: await this.documents.update(actor, id, body, req.ip) };
  }

  @Delete('documents/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.documents.remove(actor, id, req.ip);
  }
}
