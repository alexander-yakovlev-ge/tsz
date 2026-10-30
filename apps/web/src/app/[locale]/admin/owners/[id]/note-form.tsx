'use client';

import type { OwnerDetail } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { buttonClass, FormStatusAlert, TextAreaField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Служебная заметка администратора о собственнике (ТЗ п. 4.3). */
export function NoteForm({ owner }: { owner: OwnerDetail }) {
  const t = useTranslations('adminOwners');
  const router = useRouter();
  const form = useApiForm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await form.submit(() =>
      apiRequest<{ owner: OwnerDetail }>('PUT', `/api/owners/${owner.id}/note`, {
        note: data.get('note'),
      }),
    );
    if (result) {
      form.setStatus({ kind: 'success', text: t('saved') });
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormStatusAlert status={form.status} />
      <TextAreaField
        id="note"
        label={t('note')}
        rows={3}
        defaultValue={owner.note ?? ''}
        error={form.fields.note}
      />
      <div>
        <button type="submit" className={buttonClass.secondary} disabled={form.pending}>
          {form.pending ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
