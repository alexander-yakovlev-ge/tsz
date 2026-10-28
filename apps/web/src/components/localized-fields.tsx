'use client';

import { useTranslations } from 'next-intl';
import { routing } from '@/i18n/routing';
import { MarkdownField } from './markdown-field';
import { Fieldset, TextField } from './ui';

const SUFFIX = { ka: 'Ka', ru: 'Ru', en: 'En' } as const;

export interface LocalizedField {
  /** Имя поля без языка: title → titleKa, titleRu, titleEn */
  name: string;
  label: string;
  markdown?: boolean;
  maxLength?: number;
}

/**
 * Переводы полей, сгруппированные по языкам: все три обязательны (ТЗ п. 3.2).
 * values и errors — по полным именам (titleKa…). idPrefix нужен, если таких форм на странице
 * несколько: меняет id полей, но не их имена в FormData.
 */
export function LocalizedFields({
  fields,
  values = {},
  errors,
  idPrefix,
}: {
  fields: LocalizedField[];
  values?: Record<string, unknown>;
  errors: Record<string, string>;
  idPrefix?: string;
}) {
  const t = useTranslations('form');
  return (
    <>
      {routing.locales.map((locale) => (
        <Fieldset key={locale} legend={t(`languages.${locale}`)}>
          {fields.map((field) => {
            const name = `${field.name}${SUFFIX[locale]}`;
            const id = idPrefix ? `${idPrefix}-${name}` : name;
            const value = typeof values[name] === 'string' ? values[name] : '';
            return field.markdown ? (
              <MarkdownField
                key={id}
                id={id}
                name={name}
                label={field.label}
                defaultValue={value}
                error={errors[name]}
              />
            ) : (
              <TextField
                key={id}
                id={id}
                name={name}
                label={field.label}
                lang={locale}
                defaultValue={value}
                maxLength={field.maxLength}
                error={errors[name]}
                autoComplete="off"
              />
            );
          })}
        </Fieldset>
      ))}
    </>
  );
}

/** Значения переводов из FormData: { titleKa, titleRu, titleEn, … }. */
export function readLocalized(form: FormData, names: string[]): Record<string, string> {
  return Object.fromEntries(
    names.flatMap((name) =>
      routing.locales.map((locale) => {
        const key = `${name}${SUFFIX[locale]}`;
        return [key, String(form.get(key) ?? '')];
      }),
    ),
  );
}
