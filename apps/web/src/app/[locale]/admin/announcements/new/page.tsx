import { toTbilisiLocal } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { AnnouncementForm } from '../announcement-form';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminAnnouncements' });
  return { title: t('newTitle') };
}

export default async function NewAnnouncementPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('adminAnnouncements');

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/announcements" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <PageTitle>{t('newTitle')}</PageTitle>
      <Card>
        <AnnouncementForm defaultPublishedAt={toTbilisiLocal(new Date())} />
      </Card>
    </div>
  );
}
