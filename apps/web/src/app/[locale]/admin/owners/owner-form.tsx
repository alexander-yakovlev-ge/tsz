'use client';

import { OWNER_KINDS, type OwnerDetail } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import {
  buttonClass,
  FormStatusAlert,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/**
 * Создание и редактирование собственника (ТЗ п. 8.12). Номера документов — по одному
 * в строке; API нормализует их (без пробелов и дефисов, верхний регистр).
 */
export function OwnerForm({ owner }: { owner?: OwnerDetail }) {
  const t = useTranslations('adminOwners');
  const tu = useTranslations('units');
  const router = useRouter();
  const form = useApiForm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      kind: data.get('kind'),
      registryName: data.get('registryName'),
      displayName: data.get('displayName'),
      idNumbers: String(data.get('idNumbers') ?? '')
        .split(/[\n,;|]+/)
        .map((value) => value.trim())
        .filter(Boolean),
      note: data.get('note'),
    };
    const result = await form.submit(() =>
      owner
        ? apiRequest<{ owner: OwnerDetail }>('PUT', `/api/owners/${owner.id}`, body)
        : apiRequest<{ owner: OwnerDetail }>('POST', '/api/owners', body),
    );
    if (!result) {
      return;
    }
    if (owner) {
      form.setStatus({ kind: 'success', text: t('saved') });
      router.refresh();
    } else {
      router.push(`/admin/owners/${result.data.owner.id}`);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormStatusAlert status={form.status} />
      <SelectField
        id="kind"
        label={t('kind')}
        defaultValue={owner?.kind ?? 'PERSON'}
        error={form.fields.kind}
        options={OWNER_KINDS.map((value) => ({ value, label: tu(`ownerKinds.${value}`) }))}
      />
      <TextField
        id="registryName"
        label={t('registryName')}
        hint={t('registryNameHint')}
        lang="ka"
        defaultValue={owner?.registryName}
        error={form.fields.registryName}
        required
      />
      <TextField
        id="displayName"
        label={t('displayName')}
        hint={t('displayNameHint')}
        defaultValue={owner?.displayName ?? ''}
        error={form.fields.displayName}
      />
      <TextAreaField
        id="idNumbers"
        label={t('idNumbers')}
        hint={t('idNumbersHint')}
        rows={3}
        autoComplete="off"
        defaultValue={owner?.idNumbers.join('\n')}
        error={form.fields.idNumbers}
      />
      <TextAreaField
        id="note"
        label={t('note')}
        rows={3}
        defaultValue={owner?.note ?? ''}
        error={form.fields.note}
      />
      <div>
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {owner
            ? form.pending
              ? t('saving')
              : t('save')
            : form.pending
              ? t('creating')
              : t('create')}
        </button>
      </div>
    </form>
  );
}
