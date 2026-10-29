'use client';

import { DOCUMENT_MAX_SIZE, UNIT_DOCUMENT_KINDS, type UnitDocumentItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { DocumentMeta } from './document-meta';
import { buttonClass, FormStatusAlert, SelectField, TextField } from './ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

const ACCEPT = '.pdf,.docx,.xlsx,.jpg,.jpeg,.png';

/** Список документов помещения со скачиванием; администратор ещё загружает и удаляет (ТЗ п. 4.19). */
export function UnitDocuments({
  unitId,
  documents,
  manage = false,
}: {
  unitId: string;
  documents: UnitDocumentItem[];
  manage?: boolean;
}) {
  const t = useTranslations('unitDocuments');
  const te = useTranslations('errors');
  const router = useRouter();
  const upload = useApiForm();
  const remove = useApiForm();
  const [formKey, setFormKey] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file');
    if (file instanceof File && file.size > DOCUMENT_MAX_SIZE) {
      upload.setStatus({ kind: 'error', text: te('FILE_TOO_LARGE') });
      return;
    }
    if (await upload.submit(() => apiRequest('POST', `/api/units/${unitId}/documents`, data))) {
      setFormKey(formKey + 1);
      upload.setStatus({ kind: 'success', text: t('uploaded') });
      router.refresh();
    }
  }

  async function removeDocument(document: UnitDocumentItem) {
    if (
      !window.confirm(t('deleteConfirm', { name: document.title ?? document.originalFilename }))
    ) {
      return;
    }
    if (
      await remove.submit(() =>
        apiRequest('DELETE', `/api/units/${unitId}/documents/${document.id}`),
      )
    ) {
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <FormStatusAlert status={remove.status} />
      {documents.length === 0 ? (
        <p className="text-gray-600">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <a
                  href={`/api/units/${unitId}/documents/${document.id}/download`}
                  className="font-bold break-words text-accent underline-offset-4 hover:underline"
                >
                  {document.title ?? t(`kinds.${document.kind}`)}
                </a>
                <span className="text-sm break-words text-gray-600">
                  {t(`kinds.${document.kind}`)} · {document.originalFilename}
                </span>
                <DocumentMeta document={document} />
              </span>
              {manage && (
                <button
                  type="button"
                  onClick={() => removeDocument(document)}
                  className={buttonClass.secondary}
                  disabled={remove.pending}
                >
                  {t('delete')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {manage && (
        <form key={formKey} onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <h3 className="font-bold">{t('uploadTitle')}</h3>
          <FormStatusAlert status={upload.status} />
          <SelectField
            id="kind"
            label={t('kind')}
            defaultValue="REGISTRY_EXTRACT"
            options={UNIT_DOCUMENT_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
          />
          <TextField id="title" label={t('title')} error={upload.fields.title} />
          <TextField
            id="file"
            label={t('file')}
            hint={t('fileHint')}
            type="file"
            accept={ACCEPT}
            required
            className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-base file:mr-3 file:rounded-full file:border-0 file:bg-gray-100 file:px-4 file:py-1.5 file:font-semibold"
          />
          <div>
            <button type="submit" className={buttonClass.primary} disabled={upload.pending}>
              {upload.pending ? t('uploading') : t('upload')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
