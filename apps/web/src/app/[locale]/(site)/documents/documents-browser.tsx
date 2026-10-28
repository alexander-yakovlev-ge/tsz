'use client';

import { DocumentCategoryItem, DocumentItem, localized } from '@tsz/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { DocumentMeta, VisibilityBadge } from '@/components/document-meta';

/** Документы по категориям в порядке sort_order и поиск по названию на клиенте (ТЗ п. 6.3). */
export function DocumentsBrowser({
  categories,
  documents,
}: {
  categories: DocumentCategoryItem[];
  documents: DocumentItem[];
}) {
  const t = useTranslations('documents');
  const locale = useLocale();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase(locale);
  const matches = needle
    ? documents.filter((document) =>
        localized(document, 'title', locale).toLocaleLowerCase(locale).includes(needle),
      )
    : documents;
  const groups = categories
    .map((category) => ({
      category,
      documents: matches.filter((document) => document.categoryId === category.id),
    }))
    .filter((group) => group.documents.length > 0);

  if (documents.length === 0) {
    return <p className="text-gray-600">{t('empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-md flex-col gap-1.5">
        <label htmlFor={searchId} className="font-semibold">
          {t('search')}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-base focus:border-accent focus:outline-2 focus:outline-accent/30"
        />
      </div>

      <p className="sr-only" role="status">
        {needle ? t('found', { count: matches.length }) : ''}
      </p>
      {groups.length === 0 && <p className="text-gray-600">{t('nothingFound')}</p>}

      {groups.map(({ category, documents: items }) => (
        <section
          key={category.id}
          aria-labelledby={`category-${category.id}`}
          className="flex flex-col gap-3"
        >
          <h2 id={`category-${category.id}`} className="text-2xl font-bold">
            {localized(category, 'name', locale)}
          </h2>
          <ul className="flex flex-col divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {items.map((document) => {
              const title = localized(document, 'title', locale);
              return (
                <li
                  key={document.id}
                  data-testid="document"
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {title}
                      <VisibilityBadge visibility={document.visibility} />
                    </span>
                    <DocumentMeta document={document} />
                  </div>
                  <a
                    href={`/api/documents/${document.id}/download`}
                    className="inline-flex min-h-11 items-center rounded-full border border-gray-300 px-5 font-bold hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                    aria-label={t('downloadNamed', { title })}
                  >
                    {t('download')}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
