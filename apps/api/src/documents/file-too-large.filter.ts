import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { ApiErrorBody } from '@tsz/shared';
import type { Response } from 'express';

/** Multer прерывает загрузку сверх лимита — отвечаем кодом, который переводит фронтенд. */
@Catch(PayloadTooLargeException)
export class FileTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const body: ApiErrorBody = { statusCode: HttpStatus.PAYLOAD_TOO_LARGE, code: 'FILE_TOO_LARGE' };
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
