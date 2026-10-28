import { DocumentCategoryItem, localized } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { CategoryForm } from './category-form';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminDocuments' });
  return { title: t('categoriesTitle') };
}

/** Категории документов: создание, переименование, порядок, удаление пустой (ТЗ п. 8.6). */
export default async function DocumentCategoriesPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, result] = await Promise.all([
    getTranslations('adminDocuments'),
    apiGet<{ categories: DocumentCategoryItem[] }>('/api/document-categories'),
  ]);
  const categories = result?.categories ?? [];
  const nextSortOrder = Math.max(0, ...categories.map((category) => category.sortOrder)) + 10;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/documents" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <PageTitle>{t('categoriesTitle')}</PageTitle>
      <p className="text-gray-600">{t('categoriesIntro')}</p>
      {categories.map((category) => (
        <Card key={category.id}>
          <h2 className="mb-4 text-xl font-bold">{localized(category, 'name', locale)}</h2>
          <CategoryForm
            key={`${category.id}-${category.sortOrder}-${category.documentCount}`}
            category={category}
          />
        </Card>
      ))}
      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('newCategory')}</h2>
        <CategoryForm nextSortOrder={nextSortOrder} />
      </Card>
    </div>
  );
}
