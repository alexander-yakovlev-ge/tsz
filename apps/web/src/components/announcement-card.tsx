import { AnnouncementItem, excerpt, localized, markdownToPlainText } from '@tsz/shared';
import type { Locale } from 'next-intl';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Badge } from './ui';

/** Превью объявления: заголовок, дата, начало текста, «Читать далее» (ТЗ п. 6.1). */
export async function AnnouncementCard({
  announcement,
  locale,
  headingLevel = 2,
}: {
  announcement: AnnouncementItem;
  locale: Locale;
  headingLevel?: 2 | 3;
}) {
  const [t, format] = await Promise.all([getTranslations('announcements'), getFormatter()]);
  const title = localized(announcement, 'title', locale);
  const Heading = `h${headingLevel}` as const;

  return (
    <article
      data-testid="announcement"
      className={`flex flex-col gap-2 rounded-2xl border p-5 break-words ${
        announcement.isPinned ? 'border-accent/40 bg-accent/5' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
        {announcement.isPinned && <Badge tone="accent">{t('pinned')}</Badge>}
        <time dateTime={announcement.publishedAt}>
          {format.dateTime(new Date(announcement.publishedAt), {
            dateStyle: 'long',
            timeStyle: 'short',
          })}
        </time>
      </div>
      <Heading className="text-xl font-bold">
        <Link
          href={`/announcements/${announcement.id}`}
          className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {title}
        </Link>
      </Heading>
      <p className="text-gray-700">
        {excerpt(markdownToPlainText(localized(announcement, 'body', locale)), 240)}
      </p>
      <div>
        <Link
          href={`/announcements/${announcement.id}`}
          className="font-bold text-accent underline-offset-4 hover:underline"
          aria-label={t('readMoreAbout', { title })}
        >
          {t('readMore')}
        </Link>
      </div>
    </article>
  );
}
