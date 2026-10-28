'use client';

import type { DocumentCategoryItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { LocalizedFields, readLocalized } from '@/components/localized-fields';
import { buttonClass, FormStatusAlert, TextField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/**
 * Создание (category не задана) и изменение категории: названия и порядок (ТЗ п. 8.6).
 * Удалить можно только пустую категорию.
 */
export function CategoryForm({
  category,
  nextSortOrder = 0,
}: {
  category?: DocumentCategoryItem;
  nextSortOrder?: number;
}) {
  const t = useTranslations('adminDocuments');
  const tf = useTranslations('form');
  const router = useRouter();
  const form = useApiForm();
  const [formKey, setFormKey] = useState(0);
  // id полей уникальны на странице: форм категорий несколько.
  const prefix = category ? `category-${category.id}` : 'category-new';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      ...readLocalized(data, ['name']),
      sortOrder: Number(data.get('sortOrder')),
    };
    const result = await form.submit(() =>
      category
        ? apiRequest('PUT', `/api/document-categories/${category.id}`, body)
        : apiRequest('POST', '/api/document-categories', body),
    );
    if (result) {
      if (!category) {
        setFormKey(formKey + 1);
      }
      form.setStatus({ kind: 'success', text: category ? tf('saved') : t('categoryCreated') });
      router.refresh();
    }
  }

  async function remove() {
    if (!category || !window.confirm(t('categoryDeleteConfirm'))) {
      return;
    }
    const result = await form.submit(() =>
      apiRequest('DELETE', `/api/document-categories/${category.id}`),
    );
    if (result) {
      router.refresh();
    }
  }

  return (
    <form key={formKey} onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormStatusAlert status={form.status} />
      <LocalizedFields
        idPrefix={prefix}
        fields={[{ name: 'name', label: t('categoryName'), maxLength: 100 }]}
        values={category}
        errors={form.fields}
      />
      <TextField
        id={`${prefix}-sortOrder`}
        name="sortOrder"
        label={t('sortOrder')}
        hint={t('sortOrderHint')}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        defaultValue={category?.sortOrder ?? nextSortOrder}
        error={form.fields.sortOrder}
        className="min-h-11 w-32 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-base"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {category ? (form.pending ? tf('saving') : tf('save')) : t('addCategory')}
        </button>
        {category &&
          (category.documentCount === 0 ? (
            <button
              type="button"
              onClick={remove}
              className={buttonClass.danger}
              disabled={form.pending}
            >
              {t('deleteCategory')}
            </button>
          ) : (
            <span className="text-sm text-gray-600">
              {t('categoryInUse', { count: category.documentCount })}
            </span>
          ))}
      </div>
    </form>
  );
}
