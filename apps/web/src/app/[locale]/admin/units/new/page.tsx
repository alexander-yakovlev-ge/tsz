import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { UnitForm } from '../unit-form';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminUnits' });
  return { title: t('newTitle') };
}

export default async function NewUnitPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('adminUnits');

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/admin/units" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <PageTitle>{t('newTitle')}</PageTitle>
      <Card>
        <UnitForm />
      </Card>
    </div>
  );
}
