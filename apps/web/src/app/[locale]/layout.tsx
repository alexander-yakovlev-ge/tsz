import '@fontsource-variable/manrope';
import '@fontsource-variable/noto-sans-georgian';
import '../globals.css';
import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { routing } from '@/i18n/routing';
import { LocaleParams, readLocale } from '@/i18n/params';
import { siteUrl } from '@/lib/site';

interface Props {
  children: ReactNode;
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
  });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('meta.siteName'), template: `%s · ${t('meta.siteName')}` },
    description: t('meta.description'),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col">
        <NextIntlClientProvider>
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
