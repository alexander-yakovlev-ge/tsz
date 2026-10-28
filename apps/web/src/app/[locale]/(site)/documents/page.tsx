import type { DocumentCategoryItem, DocumentItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageTitle } from '@/components/ui';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/site';
import { DocumentsBrowser } from './documents-browser';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'documents' });
  return pageMetadata(locale, '/documents', t('title'), t('description'));
}

/** Документы (ТЗ п. 6.3): набор зависит от пользователя, поэтому страница динамическая. */
export default async function DocumentsPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, categories, documents] = await Promise.all([
    getTranslations('documents'),
    apiGet<{ categories: DocumentCategoryItem[] }>('/api/document-categories'),
    apiGet<{ documents: DocumentItem[] }>('/api/documents'),
  ]);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <DocumentsBrowser
        categories={categories?.categories ?? []}
        documents={documents?.documents ?? []}
      />
    </div>
  );
}
