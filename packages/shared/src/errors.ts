/**
 * Коды ошибок API. Ответ с ошибкой содержит `code`, текст переводит фронтенд (ТЗ п. 9).
 * Коды полей (`fields`) — это сообщения Zod-схем: INVALID_PHONE, PASSWORD_TOO_SHORT и т. д.
 */
export const ERROR_CODES = [
  'VALIDATION',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'ORIGIN_MISMATCH',
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'WRONG_PASSWORD',
  'PHONE_TAKEN',
  'CANNOT_DELETE_SELF',
  'CANNOT_DEMOTE_SELF',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const FIELD_ERROR_CODES = [
  'REQUIRED',
  'INVALID_PHONE',
  'PASSWORD_TOO_SHORT',
  'TOO_LONG',
  'INVALID_VALUE',
] as const;

export type FieldErrorCode = (typeof FIELD_ERROR_CODES)[number];

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  /** Ошибки полей при code = VALIDATION: путь поля → код */
  fields?: Record<string, FieldErrorCode>;
}
