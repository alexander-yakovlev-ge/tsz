import { HttpException } from '@nestjs/common';
import type { ApiErrorBody, ErrorCode, FieldErrorCode } from '@tsz/shared';

/** Ошибка API с кодом, который переводит фронтенд (ТЗ п. 9). */
export class ApiError extends HttpException {
  constructor(status: number, code: ErrorCode, fields?: Record<string, FieldErrorCode>) {
    const body: ApiErrorBody = { statusCode: status, code, ...(fields ? { fields } : {}) };
    super(body, status);
  }
}
