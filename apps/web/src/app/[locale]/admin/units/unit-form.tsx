'use client';

import { TARIFF_CATEGORIES, UNIT_KINDS, type UnitItem, type UnitKind } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { buttonClass, FormStatusAlert, SelectField, TextField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Создание (unit не задан) и редактирование помещения (ТЗ п. 8.1). */
export function UnitForm({ unit }: { unit?: UnitItem }) {
  const t = useTranslations('adminUnits');
  const tu = useTranslations('units');
  const router = useRouter();
  const form = useApiForm();
  const [kind, setKind] = useState<UnitKind>(unit?.kind ?? 'APARTMENT');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const floor = String(data.get('floor') ?? '').trim();
    const body = {
      kind,
      cadastralCode: data.get('cadastralCode'),
      number: data.get('number'),
      floor: floor === '' ? null : Number(floor),
      floorLabel: data.get('floorLabel'),
      areaM2: data.get('areaM2'),
      tariffCategory: kind === 'APARTMENT' ? data.get('tariffCategory') : null,
    };
    const result = await form.submit(() =>
      unit
        ? apiRequest<{ unit: UnitItem }>('PUT', `/api/units/${unit.id}`, body)
        : apiRequest<{ unit: UnitItem }>('POST', '/api/units', body),
    );
    if (!result) {
      return;
    }
    if (unit) {
      form.setStatus({ kind: 'success', text: t('saved') });
      router.refresh();
    } else {
      router.push(`/admin/units/${result.data.unit.id}`);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormStatusAlert status={form.status} />
      <SelectField
        id="kind"
        label={t('kind')}
        value={kind}
        onChange={(event) => setKind(event.target.value as UnitKind)}
        error={form.fields.kind}
        options={UNIT_KINDS.map((value) => ({ value, label: tu(`kinds.${value}`) }))}
      />
      <TextField
        id="cadastralCode"
        label={t('cadastralCode')}
        hint={t('cadastralCodeHint')}
        defaultValue={unit?.cadastralCode}
        autoComplete="off"
        error={form.fields.cadastralCode}
        required
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="number"
          label={t('number')}
          hint={t('numberHint')}
          defaultValue={unit?.number}
          autoComplete="off"
          error={form.fields.number}
          required
        />
        <TextField
          id="areaM2"
          label={t('areaM2')}
          inputMode="decimal"
          defaultValue={unit?.areaM2}
          autoComplete="off"
          error={form.fields.areaM2}
          required
        />
        <TextField
          id="floor"
          label={t('floor')}
          type="number"
          defaultValue={unit?.floor ?? ''}
          error={form.fields.floor}
        />
        <TextField
          id="floorLabel"
          label={t('floorLabel')}
          hint={t('floorLabelHint')}
          defaultValue={unit?.floorLabel ?? ''}
          error={form.fields.floorLabel}
        />
      </div>
      {kind === 'APARTMENT' && (
        <SelectField
          id="tariffCategory"
          label={t('category')}
          defaultValue={unit?.tariffCategory ?? 'FULL'}
          error={form.fields.tariffCategory}
          options={TARIFF_CATEGORIES.map((value) => ({ value, label: tu(`categories.${value}`) }))}
        />
      )}
      <div>
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {unit
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
