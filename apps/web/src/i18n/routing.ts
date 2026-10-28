// Модуль, а не весь пакет: routing попадает в клиентский бандл, а пакет тянет jose и libphonenumber.
import { DEFAULT_LOCALE, LOCALES } from '@tsz/shared/dist/locales';
import { defineRouting } from 'next-intl/routing';

/**
 * Язык — в префиксе URL: /ka, /ru, /en (ТЗ п. 3.2). Запрос без префикса перенаправляется
 * на язык из cookie или браузера, по умолчанию грузинский (ТЗ п. 10).
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
