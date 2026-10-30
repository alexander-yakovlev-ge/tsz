'use client';

import { TARIFF_CATEGORIES, type UnitItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { buttonClass, FormStatusAlert, SelectField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Категория тарифа квартиры — единственное поле помещения, которое меняется вручную (ТЗ п. 8.1). */
export function CategoryForm({ unit }: { unit: UnitItem }) {
  const t = useTranslations('adminUnits');
  const tu = useTranslations('units');
  const router = useRouter();
  const form = useApiForm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await form.submit(() =>
      apiRequest<{ unit: UnitItem }>('PUT', `/api/units/${unit.id}/category`, {
        tariffCategory: data.get('tariffCategory'),
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
      <SelectField
        id="tariffCategory"
        label={t('category')}
        hint={t('categoryHint')}
        defaultValue={unit.tariffCategory ?? 'FULL'}
        error={form.fields.tariffCategory}
        options={TARIFF_CATEGORIES.map((value) => ({ value, label: tu(`categories.${value}`) }))}
      />
      <div>
        <button type="submit" className={buttonClass.secondary} disabled={form.pending}>
          {form.pending ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
