import type { ContactInfo } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactsBlock } from '@/components/contacts-block';
import { Card, PageTitle } from '@/components/ui';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/site';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'contacts' });
  return pageMetadata(locale, '/contacts', t('title'), t('description'));
}

/** Контакты (ТЗ п. 6.5). */
export default async function ContactsPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations('contacts'),
    apiGet<{ contacts: ContactInfo }>('/api/contacts'),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-gray-600">{t('intro')}</p>
      {result ? (
        <Card>
          <ContactsBlock contacts={result.contacts} locale={locale} />
        </Card>
      ) : (
        <p className="text-gray-600">{t('unavailable')}</p>
      )}
    </div>
  );
}
