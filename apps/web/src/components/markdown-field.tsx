'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Markdown } from './markdown';
import { TextAreaField } from './ui';

/** Поле Markdown с предпросмотром (ТЗ п. 8.8). Текст остаётся в форме и при предпросмотре. */
export function MarkdownField({
  id,
  name = id,
  label,
  error,
  defaultValue = '',
  rows = 8,
}: {
  id: string;
  name?: string;
  label: string;
  error?: string;
  defaultValue?: string;
  rows?: number;
}) {
  const t = useTranslations('form');
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className={preview ? 'hidden' : undefined}>
        <TextAreaField
          id={id}
          name={name}
          label={label}
          hint={t('markdownHint')}
          error={error}
          rows={rows}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      {preview && (
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold">{label}</span>
          <div className="min-h-24 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
            {value.trim() ? (
              <Markdown>{value}</Markdown>
            ) : (
              <p className="text-gray-500">{t('previewEmpty')}</p>
            )}
          </div>
        </div>
      )}
      <div>
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          aria-pressed={preview}
          className="text-sm font-bold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {preview ? t('edit') : t('preview')}
        </button>
      </div>
    </div>
  );
}
