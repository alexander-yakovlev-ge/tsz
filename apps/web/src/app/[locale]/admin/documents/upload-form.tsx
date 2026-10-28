'use client';

import { DOCUMENT_MAX_SIZE, DocumentCategoryItem, DocumentItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { buttonClass, FormStatusAlert, TextField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';
import { DocumentFields } from './document-fields';

const ACCEPT = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png';

/** Загрузка документа (ТЗ п. 8.6). Размер проверяется и здесь, чтобы не гнать 20+ МБ зря. */
export function UploadForm({ categories }: { categories: DocumentCategoryItem[] }) {
  const t = useTranslations('adminDocuments');
  const te = useTranslations('errors');
  const router = useRouter();
  const form = useApiForm();
  // Новый key очищает форму после успешной загрузки.
  const [formKey, setFormKey] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file');
    if (file instanceof File && file.size > DOCUMENT_MAX_SIZE) {
      form.setStatus({ kind: 'error', text: te('FILE_TOO_LARGE') });
      form.setFields({ file: te('FILE_TOO_LARGE') });
      return;
    }
    const result = await form.submit(() =>
      apiRequest<{ document: DocumentItem }>('POST', '/api/documents', data),
    );
    if (result) {
      setFormKey(formKey + 1);
      form.setStatus({ kind: 'success', text: t('uploaded') });
      router.refresh();
    }
  }

  return (
    <form key={formKey} onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormStatusAlert status={form.status} />
      <DocumentFields categories={categories} errors={form.fields} />
      <TextField
        id="file"
        label={t('file')}
        hint={t('fileHint')}
        type="file"
        accept={ACCEPT}
        error={form.fields.file}
        required
        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-base file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-1.5 file:font-semibold"
      />
      <div>
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {form.pending ? t('uploading') : t('upload')}
        </button>
      </div>
    </form>
  );
}
