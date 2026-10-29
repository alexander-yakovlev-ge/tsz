'use client';

import { ownerName, type OwnerDetail } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { OwnerSearch } from '@/components/owner-search';
import { FormStatusAlert } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Слияние дубля в эту запись (ТЗ п. 8.12): помещения, номера и учётная запись переходят сюда. */
export function MergeOwner({ owner }: { owner: OwnerDetail }) {
  const t = useTranslations('adminOwners');
  const router = useRouter();
  const form = useApiForm();

  async function merge(duplicateId: string, duplicateName: string) {
    if (
      !window.confirm(t('mergeConfirm', { duplicate: duplicateName, primary: ownerName(owner) }))
    ) {
      return;
    }
    const result = await form.submit(() =>
      apiRequest('POST', `/api/owners/${owner.id}/merge`, { duplicateId }),
    );
    if (result) {
      form.setStatus({ kind: 'success', text: t('merged') });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormStatusAlert status={form.status} />
      <OwnerSearch
        id="merge-search"
        label={t('mergeSearch')}
        actionLabel={t('mergeAction')}
        exclude={[owner.id]}
        onSelect={(duplicate) => merge(duplicate.id, ownerName(duplicate))}
      />
    </div>
  );
}
