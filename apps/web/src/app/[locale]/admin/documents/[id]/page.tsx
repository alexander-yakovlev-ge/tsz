import { DocumentCategoryItem, DocumentItem, localized } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DocumentMeta } from '@/components/document-meta';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { DeleteDocumentButton } from './delete-document-button';
import { DocumentEditForm } from './document-edit-form';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminDocuments' });
  return { title: t('editTitle') };
}

export default async function EditDocumentPage({ params }: Props) {
  const { id } = await params;
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, documentResult, categoriesResult] = await Promise.all([
    getTranslations('adminDocuments'),
    apiGet<{ document: DocumentItem }>(`/api/documents/${encodeURIComponent(id)}`),
    apiGet<{ categories: DocumentCategoryItem[] }>('/api/document-categories'),
  ]);
  if (!documentResult) {
    notFound();
  }
  const { document } = documentResult;
  const title = localized(document, 'title', locale);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/documents" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <div className="flex flex-col gap-2">
        <PageTitle>{title}</PageTitle>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-gray-600">{document.originalFilename}</span>
          <DocumentMeta document={document} />
          <a
            href={`/api/documents/${document.id}/download`}
            className="font-semibold text-accent underline-offset-4 hover:underline"
          >
            {t('download')}
          </a>
        </span>
      </div>
      <Card>
        <DocumentEditForm document={document} categories={categoriesResult?.categories ?? []} />
      </Card>
      <Card className="border-red-200">
        <h2 className="mb-2 text-xl font-bold">{t('deleteTitle')}</h2>
        <p className="mb-4 text-sm text-gray-600">{t('deleteHint')}</p>
        <DeleteDocumentButton documentId={document.id} title={title} />
      </Card>
    </div>
  );
}
