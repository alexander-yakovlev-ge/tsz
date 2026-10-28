import type { AnnouncementPage } from '@tsz/shared';
import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { apiGetPublic } from '@/lib/api';
import { localeAlternates, siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

const PUBLIC_PAGES = ['', '/announcements', '/documents', '/contacts'];
const MAX_PAGES = 50;

/** Опубликованные объявления: путь и дата для lastModified. */
async function announcementPaths(): Promise<{ path: string; date: string }[]> {
  const paths: { path: string; date: string }[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await apiGetPublic<AnnouncementPage>(`/api/announcements?page=${page}`);
    if (!result) {
      break;
    }
    paths.push(
      ...result.items.map((item) => ({
        path: `/announcements/${item.id}`,
        date: item.publishedAt,
      })),
    );
    if (page >= result.pageCount) {
      break;
    }
  }
  return paths;
}

/** sitemap.xml (ТЗ п. 10): публичные страницы и объявления на трёх языках с hreflang. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = [
    ...PUBLIC_PAGES.map((path) => ({ path, date: undefined as string | undefined })),
    ...(await announcementPaths()),
  ];
  return pages.flatMap(({ path, date }) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      ...(date ? { lastModified: date } : {}),
      alternates: {
        languages: Object.fromEntries(
          Object.entries(localeAlternates(path)).map(([lang, href]) => [lang, `${base}${href}`]),
        ),
      },
    })),
  );
}
