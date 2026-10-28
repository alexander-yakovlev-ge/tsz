import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { SECTIONS } from './sections';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'admin' });
  return { title: t('title') };
}

/** Дашборд-заглушка: сводка (ТЗ п. 8.0) появится вместе с финансами. */
export default async function AdminDashboard({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-gray-600">{t('dashboardIntro')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section}
            href={`/admin/${section}`}
            className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="text-lg font-bold">{t(`sections.${section}.title`)}</span>
            <span className="text-sm text-gray-600">{t(`sections.${section}.card`)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
