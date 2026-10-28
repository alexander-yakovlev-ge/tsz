'use client';

import type { DocumentCategoryItem, DocumentItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { readLocalized } from '@/components/localized-fields';
import { buttonClass, FormStatusAlert } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';
import { DocumentFields } from '../document-fields';

/** Заголовок, категория и доступ без повторной загрузки файла (ТЗ п. 8.6). */
export function DocumentEditForm({
  document,
  categories,
}: {
  document: DocumentItem;
  categories: DocumentCategoryItem[];
}) {
  const tf = useTranslations('form');
  const router = useRouter();
  const form = useApiForm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      ...readLocalized(data, ['title']),
      categoryId: data.get('categoryId'),
      visibility: data.get('visibility'),
    };
    const result = await form.submit(() =>
      apiRequest('PUT', `/api/documents/${document.id}`, body),
    );
    if (result) {
      form.setStatus({ kind: 'success', text: tf('saved') });
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormStatusAlert status={form.status} />
      <DocumentFields categories={categories} document={document} errors={form.fields} />
      <div>
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {form.pending ? tf('saving') : tf('save')}
        </button>
      </div>
    </form>
  );
}
