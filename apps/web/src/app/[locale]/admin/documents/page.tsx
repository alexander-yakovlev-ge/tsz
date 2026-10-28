import { DocumentCategoryItem, DocumentItem, localized } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DocumentMeta, VisibilityBadge } from '@/components/document-meta';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { UploadForm } from './upload-form';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminDocuments' });
  return { title: t('title') };
}

/** Загрузка и список всех документов (ТЗ п. 8.6). Категории — на отдельной странице. */
export default async function AdminDocumentsPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, categoriesResult, documentsResult] = await Promise.all([
    getTranslations('adminDocuments'),
    apiGet<{ categories: DocumentCategoryItem[] }>('/api/document-categories'),
    apiGet<{ documents: DocumentItem[] }>('/api/documents'),
  ]);
  const categories = categoriesResult?.categories ?? [];
  const documents = documentsResult?.documents ?? [];
  const categoryName = new Map(
    categories.map((category) => [category.id, localized(category, 'name', locale)]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t('title')}</PageTitle>
        <Link
          href="/admin/documents/categories"
          className="font-bold text-accent underline-offset-4 hover:underline"
        >
          {t('manageCategories')}
        </Link>
      </div>

      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('uploadTitle')}</h2>
        {categories.length === 0 ? (
          <p className="text-gray-600">{t('noCategories')}</p>
        ) : (
          <UploadForm categories={categories} />
        )}
      </Card>

      <section aria-labelledby="documents-title" className="flex flex-col gap-3">
        <h2 id="documents-title" className="text-xl font-bold">
          {t('allDocuments', { count: documents.length })}
        </h2>
        {documents.length === 0 ? (
          <p className="text-gray-600">{t('empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-col gap-1 px-5 py-4">
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/documents/${document.id}`}
                    className="font-bold text-accent underline-offset-4 hover:underline"
                  >
                    {localized(document, 'title', locale)}
                  </Link>
                  <VisibilityBadge visibility={document.visibility} full />
                </span>
                <span className="text-sm text-gray-600">
                  {categoryName.get(document.categoryId)} · {document.originalFilename}
                </span>
                <DocumentMeta document={document} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
