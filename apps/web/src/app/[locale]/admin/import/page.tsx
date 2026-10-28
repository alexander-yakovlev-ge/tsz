import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { LocaleParams, readLocale } from '@/i18n/params';
import { ImportWizard } from './import-wizard';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminImport' });
  return { title: t('title') };
}

/** Импорт и синхронизация (ТЗ п. 8.10). Контакты и синхронизация с новой выпиской — этап 7. */
export default async function ImportPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('adminImport');

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="max-w-3xl text-gray-600">{t('intro')}</p>
      <Card>
        <ImportWizard />
      </Card>
    </div>
  );
}
