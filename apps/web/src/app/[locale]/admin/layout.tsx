import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { NavLink } from '@/components/nav-link';
import { SiteHeader } from '@/components/site-header';
import { requireAdmin } from '@/lib/auth';
import { LocaleParams, readLocale } from '@/i18n/params';
import { SECTIONS } from './sections';

export const metadata: Metadata = { robots: { index: false } };

/** Оболочка админки: боковое меню разделов (на телефоне — над контентом). */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: LocaleParams;
}) {
  const locale = await readLocale(params);
  await requireAdmin(locale);
  const t = await getTranslations('admin');

  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-wrap gap-8 px-4 py-8 sm:px-6">
        <nav
          aria-label={t('nav')}
          className="flex w-full flex-row gap-1 overflow-x-auto md:w-52 md:flex-col"
        >
          <NavLink href="/admin" exact variant="sidebar">
            {t('dashboard')}
          </NavLink>
          {SECTIONS.map((section) => (
            <NavLink key={section} href={`/admin/${section}`} variant="sidebar">
              {t(`sections.${section}.title`)}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-[999_1_560px]">{children}</main>
      </div>
    </>
  );
}
