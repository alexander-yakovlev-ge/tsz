import { AnnouncementItem, localized } from '@tsz/shared';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { buttonClass, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { StatusBadge } from './status-badge';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminAnnouncements' });
  return { title: t('title') };
}

/** Все объявления со статусом (ТЗ п. 8.5). */
export default async function AdminAnnouncementsPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, format, result] = await Promise.all([
    getTranslations('adminAnnouncements'),
    getFormatter(),
    apiGet<{ announcements: AnnouncementItem[] }>('/api/admin/announcements'),
  ]);
  const announcements = result?.announcements ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t('title')}</PageTitle>
        <Link href="/admin/announcements/new" className={buttonClass.primary}>
          {t('add')}
        </Link>
      </div>

      {announcements.length === 0 ? (
        <p className="text-gray-600">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-gray-200 text-sm text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('titleField')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('status')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('publishedAt')}
                </th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((announcement) => (
                <tr key={announcement.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/announcements/${announcement.id}`}
                      className="font-bold text-accent underline-offset-4 hover:underline"
                    >
                      {localized(announcement, 'title', locale)}
                    </Link>
                    {announcement.isPinned && (
                      <span className="ml-2 text-sm text-gray-600">({t('pinned')})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={announcement.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format.dateTime(new Date(announcement.publishedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
