import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/site';

// SITE_URL задаётся при запуске контейнера, а не при сборке.
export const dynamic = 'force-dynamic';

/** robots.txt (ТЗ п. 10): служебные и личные разделы не индексируются. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/files/',
        ...routing.locales.flatMap((locale) => [
          `/${locale}/admin`,
          `/${locale}/account`,
          `/${locale}/login`,
        ]),
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
