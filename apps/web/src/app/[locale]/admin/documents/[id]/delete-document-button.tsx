'use client';

import { useTranslations } from 'next-intl';
import { buttonClass, FormStatusAlert } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Удаление документа вместе с файлом в хранилище (ТЗ п. 8.6). */
export function DeleteDocumentButton({ documentId, title }: { documentId: string; title: string }) {
  const t = useTranslations('adminDocuments');
  const router = useRouter();
  const form = useApiForm();

  async function remove() {
    if (!window.confirm(t('deleteConfirm', { title }))) {
      return;
    }
    const result = await form.submit(() => apiRequest('DELETE', `/api/documents/${documentId}`));
    if (result) {
      router.push('/admin/documents');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormStatusAlert status={form.status} />
      <div>
        <button
          type="button"
          onClick={remove}
          className={buttonClass.danger}
          disabled={form.pending}
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
