'use client';

import { DOCUMENT_VISIBILITIES, DocumentCategoryItem, DocumentItem, localized } from '@tsz/shared';
import { useLocale, useTranslations } from 'next-intl';
import { LocalizedFields } from '@/components/localized-fields';
import { SelectField } from '@/components/ui';

/** Заголовок на трёх языках, категория и доступ — общие для загрузки и изменения (ТЗ п. 8.6). */
export function DocumentFields({
  categories,
  document,
  errors,
}: {
  categories: DocumentCategoryItem[];
  document?: DocumentItem;
  errors: Record<string, string>;
}) {
  const t = useTranslations('adminDocuments');
  const tv = useTranslations('documents.visibility');
  const locale = useLocale();
  return (
    <>
      <LocalizedFields
        fields={[{ name: 'title', label: t('titleField'), maxLength: 300 }]}
        values={document}
        errors={errors}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          id="categoryId"
          label={t('category')}
          defaultValue={document?.categoryId ?? categories[0]?.id}
          error={errors.categoryId}
          options={categories.map((category) => ({
            value: category.id,
            label: localized(category, 'name', locale),
          }))}
        />
        <SelectField
          id="visibility"
          label={t('visibility')}
          defaultValue={document?.visibility ?? 'PUBLIC'}
          hint={t('visibilityHint')}
          error={errors.visibility}
          options={DOCUMENT_VISIBILITIES.map((value) => ({ value, label: tv(value) }))}
        />
      </div>
    </>
  );
}
