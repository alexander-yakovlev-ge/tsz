import type { HomePageContent } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { HomeForm } from './home-form';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminHome' });
  return { title: t('title') };
}

/** Главная страница (ТЗ п. 8.8). */
export default async function AdminHomePage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations('adminHome'),
    apiGet<{ home: HomePageContent }>('/api/home'),
  ]);
  if (!result) {
    notFound();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-gray-600">
        {t('intro')}{' '}
        <Link href="/" className="font-semibold text-accent underline-offset-4 hover:underline">
          {t('openPublic')}
        </Link>
      </p>
      <Card>
        <HomeForm key={result.home.updatedAt} home={result.home} />
      </Card>
    </div>
  );
}
