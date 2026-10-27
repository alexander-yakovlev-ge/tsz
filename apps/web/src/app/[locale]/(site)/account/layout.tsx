import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { LocaleParams, readLocale } from '@/i18n/params';

export const metadata: Metadata = { robots: { index: false } };

/** Личный кабинет: все, кто вошёл (ТЗ v1.7). */
export default async function AccountLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: LocaleParams;
}) {
  await requireUser(await readLocale(params));
  return children;
}
