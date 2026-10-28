import type { ContactInfo } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { ContactsForm } from './contacts-form';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminContacts' });
  return { title: t('title') };
}

/** Контакты (ТЗ п. 8.7): изменения сразу видны на публичной странице. */
export default async function AdminContactsPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations('adminContacts'),
    apiGet<{ contacts: ContactInfo }>('/api/contacts'),
  ]);
  if (!result) {
    notFound();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-gray-600">
        {t('intro')}{' '}
        <Link
          href="/contacts"
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          {t('openPublic')}
        </Link>
      </p>
      <Card>
        <ContactsForm key={result.contacts.updatedAt} contacts={result.contacts} />
      </Card>
    </div>
  );
}
