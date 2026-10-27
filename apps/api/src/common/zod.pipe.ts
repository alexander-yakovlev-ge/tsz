import { HttpStatus, PipeTransform } from '@nestjs/common';
import { FIELD_ERROR_CODES, FieldErrorCode } from '@tsz/shared';
import type { ZodType } from 'zod';
import { ApiError } from './api-error';

function toFieldCode(message: string): FieldErrorCode {
  return (FIELD_ERROR_CODES as readonly string[]).includes(message)
    ? (message as FieldErrorCode)
    : 'INVALID_VALUE';
}

/** Валидация тела запроса общей Zod-схемой (ТЗ п. 2, 11). */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) {
      return result.data;
    }
    const fields: Record<string, FieldErrorCode> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_';
      fields[path] ??= toFieldCode(issue.message);
    }
    throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION', fields);
  }
}
