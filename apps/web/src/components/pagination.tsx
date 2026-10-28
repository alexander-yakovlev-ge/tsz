import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Ссылка на страницу списка с теми же фильтрами. */
export function pageHref(
  path: string,
  query: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** Постраничная навигация списков админки (по 50 записей, ТЗ п. 8.1, 8.12). */
export async function Pagination({
  path,
  query,
  page,
  pageCount,
}: {
  path: string;
  query: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) {
    return null;
  }
  const t = await getTranslations('pagination');
  const linkClass = 'font-bold text-accent underline-offset-4 hover:underline';
  return (
    <nav
      aria-label={t('label')}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4"
    >
      {page > 1 ? (
        <Link href={pageHref(path, query, page - 1)} rel="prev" className={linkClass}>
          {t('previous')}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-gray-600">{t('pageOf', { page, count: pageCount })}</span>
      {page < pageCount ? (
        <Link href={pageHref(path, query, page + 1)} rel="next" className={linkClass}>
          {t('next')}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
