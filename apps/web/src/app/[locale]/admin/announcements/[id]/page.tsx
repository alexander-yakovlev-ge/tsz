import { AnnouncementItem, localized, toTbilisiLocal } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { AnnouncementForm } from '../announcement-form';
import { StatusBadge } from '../status-badge';
import { AnnouncementActions } from './announcement-actions';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminAnnouncements' });
  return { title: t('editTitle') };
}

export default async function EditAnnouncementPage({ params }: Props) {
  const { id } = await params;
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations('adminAnnouncements'),
    apiGet<{ announcement: AnnouncementItem }>(
      `/api/admin/announcements/${encodeURIComponent(id)}`,
    ),
  ]);
  if (!result) {
    notFound();
  }
  const { announcement } = result;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/announcements" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <div className="flex flex-col gap-2">
        <PageTitle>{localized(announcement, 'title', locale)}</PageTitle>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={announcement.status} />
          {announcement.status === 'PUBLISHED' && (
            <Link
              href={`/announcements/${announcement.id}`}
              className="font-semibold text-accent underline-offset-4 hover:underline"
            >
              {t('openPublic')}
            </Link>
          )}
        </div>
      </div>
      <Card>
        {/* key: после сохранения форма перечитывает значения с сервера */}
        <AnnouncementForm
          key={`${announcement.id}-${announcement.publishedAt}-${announcement.status}`}
          announcement={announcement}
          defaultPublishedAt={toTbilisiLocal(announcement.publishedAt)}
        />
      </Card>
      <Card>
        <h2 className="mb-2 text-xl font-bold">{t('publication')}</h2>
        <p className="mb-4 text-sm text-gray-600">{t('publicationHint')}</p>
        <AnnouncementActions announcement={announcement} />
      </Card>
    </div>
  );
}
