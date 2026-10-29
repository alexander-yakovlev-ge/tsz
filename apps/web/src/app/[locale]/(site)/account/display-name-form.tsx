'use client';

import type { MeOwner } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { buttonClass, FormStatusAlert, TextField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Отображаемое имя собственника: в реестре имя записано по-грузински (ТЗ п. 7.1). */
export function DisplayNameForm({ owner }: { owner: MeOwner }) {
  const t = useTranslations('account');
  const router = useRouter();
  const form = useApiForm();
  const id = `displayName-${owner.id}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await form.submit(() =>
      apiRequest('PUT', `/api/me/owners/${owner.id}/display-name`, { displayName: data.get(id) }),
    );
    if (result) {
      form.setStatus({ kind: 'success', text: t('displayNameSaved') });
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormStatusAlert status={form.status} />
      <p className="text-sm text-gray-600">
        {t('registryName')}: <span lang="ka">{owner.registryName}</span>
      </p>
      <TextField
        id={id}
        label={t('displayName')}
        hint={t('displayNameHint')}
        defaultValue={owner.displayName ?? ''}
        error={form.fields.displayName}
      />
      <div>
        <button type="submit" className={buttonClass.secondary} disabled={form.pending}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}
