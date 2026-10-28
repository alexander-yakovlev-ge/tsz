import type { AnnouncementPage } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AnnouncementCard } from '@/components/announcement-card';
import { PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/site';

interface Props {
  params: LocaleParams;
  searchParams: Promise<{ page?: string }>;
}

function readPage(value: string | undefined): number | null {
  if (value === undefined) {
    return 1;
  }
  return /^[1-9]\d{0,3}$/.test(value) ? Number(value) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'announcements' });
  return pageMetadata(locale, '/announcements', t('title'), t('description'));
}

/**
 * Объявления (ТЗ п. 6.1): закреплённые первыми, по 20 на странице. Открытие страницы отмечает
 * объявления прочитанными. Рендерится динамически: шапка зависит от пользователя, а отложенные
 * объявления должны появляться сразу после наступления даты.
 */
export default async function AnnouncementsPage({ params, searchParams }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const page = readPage((await searchParams).page);
  if (!page) {
    notFound();
  }
  const [t, result] = await Promise.all([
    getTranslations('announcements'),
    apiGet<AnnouncementPage>(`/api/announcements?page=${page}&markSeen=true`),
  ]);
  if (!result || (page > 1 && page > result.pageCount)) {
    notFound();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      {result.items.length === 0 ? (
        <p className="text-gray-600">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {result.items.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} locale={locale} />
          ))}
        </div>
      )}
      {result.pageCount > 1 && (
        <nav
          aria-label={t('pagination')}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4"
        >
          {page > 1 ? (
            <Link
              href={page === 2 ? '/announcements' : `/announcements?page=${page - 1}`}
              rel="prev"
              className="font-bold text-accent underline-offset-4 hover:underline"
            >
              {t('newer')}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-600">{t('pageOf', { page, count: result.pageCount })}</span>
          {page < result.pageCount ? (
            <Link
              href={`/announcements?page=${page + 1}`}
              rel="next"
              className="font-bold text-accent underline-offset-4 hover:underline"
            >
              {t('older')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
