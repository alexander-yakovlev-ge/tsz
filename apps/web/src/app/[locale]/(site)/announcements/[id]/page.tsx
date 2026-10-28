import { AnnouncementItem, excerpt, localized, markdownToPlainText } from '@tsz/shared';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Markdown } from '@/components/markdown';
import { Badge, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/site';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

/** Одно объявление на рендер: и для метаданных, и для страницы. API валидирует id как UUID. */
const getAnnouncement = cache(async (id: string) => {
  const result = await apiGet<{ announcement: AnnouncementItem }>(
    `/api/announcements/${encodeURIComponent(id)}`,
  );
  return result?.announcement ?? null;
});

function description(announcement: AnnouncementItem, locale: Locale): string {
  return excerpt(markdownToPlainText(localized(announcement, 'body', locale)), 160);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const locale = await readLocale(params);
  const announcement = await getAnnouncement(id);
  if (!announcement) {
    return {};
  }
  return pageMetadata(
    locale,
    `/announcements/${announcement.id}`,
    localized(announcement, 'title', locale),
    description(announcement, locale),
  );
}

/** Страница объявления (ТЗ п. 6.1): только опубликованные, иначе 404. */
export default async function AnnouncementPage({ params }: Props) {
  const { id } = await params;
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, format, announcement] = await Promise.all([
    getTranslations('announcements'),
    getFormatter(),
    getAnnouncement(id),
  ]);
  if (!announcement) {
    notFound();
  }

  return (
    <article className="flex max-w-3xl flex-col gap-5">
      <Link href="/announcements" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
        {announcement.isPinned && <Badge tone="accent">{t('pinned')}</Badge>}
        <time dateTime={announcement.publishedAt}>
          {format.dateTime(new Date(announcement.publishedAt), {
            dateStyle: 'long',
            timeStyle: 'short',
          })}
        </time>
      </div>
      <PageTitle>{localized(announcement, 'title', locale)}</PageTitle>
      <Markdown className="text-lg">{localized(announcement, 'body', locale)}</Markdown>
    </article>
  );
}
