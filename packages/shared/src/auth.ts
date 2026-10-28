import { z } from 'zod';
import { code, phoneField } from './fields';
import { LOCALES, Locale } from './locales';
import { ROLES, Role } from './roles';

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const passwordField = z
  .string(code('REQUIRED'))
  .min(PASSWORD_MIN_LENGTH, code('PASSWORD_TOO_SHORT'))
  .max(PASSWORD_MAX_LENGTH, code('TOO_LONG'));

/** Необязательное имя: пустая строка сохраняется как null. */
const nameField = z
  .string(code('INVALID_VALUE'))
  .trim()
  .max(200, code('TOO_LONG'))
  .nullish()
  .transform((value) => value || null);

const roleField = z.enum(ROLES, code('INVALID_VALUE'));
const languageField = z.enum(LOCALES, code('INVALID_VALUE'));

/** Телефон при входе не проверяется на формат: неверный номер — это просто неуспешный вход. */
export const loginSchema = z.object({
  phone: z.string(code('REQUIRED')).trim().min(1, code('REQUIRED')).max(32, code('TOO_LONG')),
  password: z
    .string(code('REQUIRED'))
    .min(1, code('REQUIRED'))
    .max(PASSWORD_MAX_LENGTH, code('TOO_LONG')),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z
    .string(code('REQUIRED'))
    .min(1, code('REQUIRED'))
    .max(PASSWORD_MAX_LENGTH, code('TOO_LONG')),
  newPassword: passwordField,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Без пароля API сгенерирует временный и вернёт его один раз. */
export const createUserSchema = z.object({
  phone: phoneField,
  name: nameField,
  role: roleField,
  language: languageField,
  password: passwordField.optional(),
});
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  phone: phoneField,
  name: nameField,
  role: roleField,
  language: languageField,
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: passwordField.optional(),
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export interface SessionUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  language: Locale;
}

export interface UserListItem extends SessionUser {
  createdAt: string;
}

/** Ответ на создание пользователя и сброс пароля: пароль есть, только если его сгенерировал API. */
export interface TemporaryPasswordResponse {
  temporaryPassword?: string;
}
