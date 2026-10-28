'use client';

import type { OwnerItem, Page } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { apiRequest } from '@/lib/client-api';
import { OwnerName, UnitName } from './registry';
import { buttonClass } from './ui';

/**
 * Поиск собственника по имени, номеру документа, помещению или телефону (ТЗ п. 8.1, 8.12)
 * и выбор из найденных. exclude — уже выбранные или сама карточка.
 */
export function OwnerSearch({
  id,
  label,
  actionLabel,
  exclude = [],
  onSelect,
}: {
  id: string;
  label: string;
  actionLabel: string;
  exclude?: string[];
  onSelect: (owner: OwnerItem) => void | Promise<void>;
}) {
  const t = useTranslations('ownerSearch');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OwnerItem[] | null>(null);
  const [pending, setPending] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }
    setPending(true);
    const result = await apiRequest<Page<OwnerItem>>(
      'GET',
      `/api/owners?q=${encodeURIComponent(query.trim())}`,
    );
    setPending(false);
    setResults(result.ok ? result.data.items.filter((owner) => !exclude.includes(owner.id)) : []);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Не вложенная форма: поиск часто стоит внутри другой формы */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={id}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void search(event);
              }
            }}
            placeholder={t('placeholder')}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-base focus:border-accent focus:outline-2 focus:outline-accent/30"
          />
          <button
            type="button"
            onClick={search}
            className={buttonClass.secondary}
            disabled={pending}
          >
            {t('search')}
          </button>
        </div>
      </div>
      {results &&
        (results.length === 0 ? (
          <p className="text-gray-600">{t('nothing')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
            {results.map((owner) => (
              <li
                key={owner.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex flex-col gap-1">
                  <OwnerName owner={owner} />
                  <span className="text-sm text-gray-600">
                    {owner.units.length === 0
                      ? t('noUnits')
                      : owner.units.map((unit, index) => (
                          <span key={unit.ownershipId}>
                            {index > 0 && ', '}
                            <UnitName kind={unit.kind} number={unit.number} />
                          </span>
                        ))}
                  </span>
                </span>
                <button
                  type="button"
                  className={buttonClass.secondary}
                  onClick={() => onSelect(owner)}
                >
                  {actionLabel}
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
