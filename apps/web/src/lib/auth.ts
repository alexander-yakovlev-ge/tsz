import type { SessionUser } from '@tsz/shared';
import type { Locale } from 'next-intl';
import { redirect } from '@/i18n/navigation';
import { getSession } from './api';

/**
 * Окончательная проверка на странице. Middleware пропускает устаревший токен (смена роли,
 * сброс пароля): тогда API отвечает «не вошёл», и страница отправляет на вход.
 */
export async function requireUser(locale: Locale): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    return redirect({ href: '/login', locale });
  }
  return user;
}

export async function requireAdmin(locale: Locale): Promise<SessionUser> {
  const user = await requireUser(locale);
  if (user.role !== 'ADMIN') {
    return redirect({ href: '/login', locale });
  }
  return user;
}
