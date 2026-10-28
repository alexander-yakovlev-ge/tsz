'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const LABELS = { ka: 'ქა', ru: 'RU', en: 'EN' } as const;
const NAMES = { ka: 'ქართული', ru: 'Русский', en: 'English' } as const;

/** Переключатель языка в шапке (ТЗ п. 3.2): та же страница на другом языке. */
export function LanguageSwitcher({ label }: { label: string }) {
  const current = useLocale();
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={label}
      className="flex gap-0.5 rounded-full bg-white/15 p-1 text-sm"
    >
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          lang={locale}
          title={NAMES[locale]}
          aria-current={locale === current ? 'true' : undefined}
          className={`inline-flex min-h-9 min-w-10 items-center justify-center rounded-full px-2.5 focus-visible:outline-2 focus-visible:outline-white ${
            locale === current ? 'bg-white font-bold text-ink' : 'text-white hover:bg-white/20'
          }`}
        >
          {LABELS[locale]}
        </Link>
      ))}
    </div>
  );
}
