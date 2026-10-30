import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IMPORT_MAX_SIZE,
  ImportPreview,
  ImportResult,
  OwnerResolutions,
  SessionUser,
} from '@tsz/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles } from '../../auth/decorators';
import { ApiError } from '../../common/api-error';
import { ZodPipe } from '../../common/zod.pipe';
import type { IncomingFile } from '../../documents/documents.service';
import { FileTooLargeFilter } from '../../documents/file-too-large.filter';
import { ImportService } from './import.service';

/** Решения по неоднозначным совпадениям приходят в multipart строкой JSON. */
const bodySchema = z.object({
  resolutions: z
    .string()
    .max(200_000)
    .optional()
    .transform((value, ctx): OwnerResolutions => {
      if (!value) {
        return {};
      }
      const parsed = z.record(z.string().max(100), z.string().max(200)).safeParse(
        (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })(),
      );
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', message: 'INVALID_VALUE' });
        return z.NEVER;
      }
      return parsed.data;
    }),
});
type Body = z.output<typeof bodySchema>;

function bufferOf(file: IncomingFile | undefined): Buffer {
  if (!file || file.size === 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED');
  }
  return file.buffer;
}

const upload = FileInterceptor('file', {
  limits: { fileSize: IMPORT_MAX_SIZE, files: 1, fields: 5, fieldSize: 256 * 1024 },
});

/** Импорт registry.csv: предпросмотр → подтверждение (ТЗ п. 8.10, 9). */
@Controller('import')
@Roles('ADMIN')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseFilters(FileTooLargeFilter)
  @UseInterceptors(upload)
  preview(
    @Body(new ZodPipe(bodySchema)) body: Body,
    @UploadedFile() file: IncomingFile | undefined,
  ): Promise<ImportPreview> {
    return this.imports.preview(bufferOf(file), body.resolutions);
  }

  @Post('commit')
  @HttpCode(HttpStatus.OK)
  @UseFilters(FileTooLargeFilter)
  @UseInterceptors(upload)
  commit(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodPipe(bodySchema)) body: Body,
    @UploadedFile() file: IncomingFile | undefined,
    @Req() req: Request,
  ): Promise<ImportResult> {
    return this.imports.commit(actor, bufferOf(file), body.resolutions, req.ip);
  }
}
