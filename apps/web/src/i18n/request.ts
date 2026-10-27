import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    // Все даты — в часовом поясе Asia/Tbilisi (ТЗ п. 4).
    timeZone: 'Asia/Tbilisi',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
