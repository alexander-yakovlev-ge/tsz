import type { Locale } from 'next-intl';

/** Параметры страниц под [locale]. Next.js типизирует их строкой. */
export type LocaleParams = Promise<{ locale: string }>;

/** Язык из параметров. Корневой layout уже отдал 404 для неизвестного языка, поэтому приведение безопасно. */
export async function readLocale(params: LocaleParams): Promise<Locale> {
  return (await params).locale as Locale;
}
