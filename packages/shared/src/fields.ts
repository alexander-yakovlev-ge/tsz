import { z } from 'zod';
import type { FieldErrorCode } from './errors';
import { normalizePhone } from './phone';

/** Сообщение Zod-схемы — код ошибки поля, который переводит фронтенд. */
export const code = (value: FieldErrorCode) => value;

/** Телефон в любом привычном написании → E.164 (ТЗ п. 5.1). */
export const phoneField = z
  .string(code('REQUIRED'))
  .trim()
  .min(1, code('REQUIRED'))
  .max(32, code('INVALID_PHONE'))
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: code('INVALID_PHONE') });
      return z.NEVER;
    }
    return phone;
  });

/** Обязательный текст одного из переводов (ТЗ п. 3.2: все три перевода обязательны). */
export function requiredText(max: number) {
  return z.string(code('REQUIRED')).trim().min(1, code('REQUIRED')).max(max, code('TOO_LONG'));
}
