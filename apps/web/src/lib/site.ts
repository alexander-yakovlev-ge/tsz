import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { routing } from '@/i18n/routing';

/** Публичный адрес сайта — для hreflang, sitemap и robots (ТЗ п. 12). */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? 'https://localhost').replace(/\/$/, '');
}

/** Адреса страницы на всех языках: path без префикса языка, '' — главная. */
export function localeAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map((locale) => [locale, `/${locale}${path}`])),
    'x-default': `/${routing.defaultLocale}${path}`,
  };
}

/** title и description на активном языке, canonical и hreflang (ТЗ п. 12). */
export function pageMetadata(
  locale: Locale,
  path: string,
  title: string | undefined,
  description: string,
): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: `/${locale}${path}`, languages: localeAlternates(path) },
  };
}
