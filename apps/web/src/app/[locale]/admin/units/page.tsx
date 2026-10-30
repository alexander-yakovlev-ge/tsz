import {
  Page,
  TARIFF_CATEGORIES,
  UNIT_KINDS,
  type TariffCategory,
  type UnitItem,
  type UnitKind,
} from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Pagination } from '@/components/pagination';
import { NoContactBadge, OwnerName, ShareText, UnitName } from '@/components/registry';
import { Badge, buttonClass, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';

interface Props {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminUnits' });
  return { title: t('title') };
}

const filterClass =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base focus:border-accent focus:outline-2 focus:outline-accent/30';

/** Раздел «Помещения» (ТЗ п. 8.1): поиск, фильтры, по 50 на странице. Баланс — этап 5. */
export default async function AdminUnitsPage({ params, searchParams }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const search = await searchParams;
  const query = {
    q: search.q?.trim() || undefined,
    kind: UNIT_KINDS.includes(search.kind as UnitKind) ? search.kind : undefined,
    category: TARIFF_CATEGORIES.includes(search.category as TariffCategory)
      ? search.category
      : undefined,
    noContact: search.noContact === 'true' ? 'true' : undefined,
    status: search.status === 'ARCHIVED' ? 'ARCHIVED' : undefined,
  };
  const page = Number(search.page ?? '1');
  if (!Number.isInteger(page) || page < 1) {
    notFound();
  }
  const apiQuery = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      apiQuery.set(key, value);
    }
  }
  const [t, tu, result] = await Promise.all([
    getTranslations('adminUnits'),
    getTranslations('units'),
    apiGet<Page<UnitItem>>(`/api/units?${apiQuery}`),
  ]);
  if (!result) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>

      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex min-w-56 flex-[2_1_14rem] flex-col gap-1.5">
          <span className="font-semibold">{t('search')}</span>
          <input
            type="search"
            name="q"
            defaultValue={query.q}
            placeholder={t('searchPlaceholder')}
            className={filterClass}
          />
        </label>
        <label className="flex flex-[1_1_10rem] flex-col gap-1.5">
          <span className="font-semibold">{t('kind')}</span>
          <select name="kind" defaultValue={query.kind ?? ''} className={filterClass}>
            <option value="">{t('all')}</option>
            {UNIT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {tu(`kinds.${kind}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-[1_1_10rem] flex-col gap-1.5">
          <span className="font-semibold">{t('category')}</span>
          <select name="category" defaultValue={query.category ?? ''} className={filterClass}>
            <option value="">{t('all')}</option>
            {TARIFF_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tu(`categories.${category}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2 pb-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="noContact"
              value="true"
              defaultChecked={!!query.noContact}
              className="size-5 accent-accent"
            />
            {tu('noContact')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="status"
              value="ARCHIVED"
              defaultChecked={!!query.status}
              className="size-5 accent-accent"
            />
            {t('archived')}
          </label>
        </div>
        <button type="submit" className={buttonClass.secondary}>
          {t('apply')}
        </button>
      </form>

      <p className="text-gray-600">{t('found', { count: result.total })}</p>

      {result.items.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-gray-200 text-sm text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('unit')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('owners')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('category')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  {t('area')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((unit) => (
                <tr key={unit.id} className="border-b border-gray-100 align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/units/${unit.id}`}
                      className="font-bold whitespace-nowrap text-accent underline-offset-4 hover:underline"
                    >
                      <UnitName kind={unit.kind} number={unit.number} />
                    </Link>
                    <div className="text-sm text-gray-600">{unit.cadastralCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="flex flex-col gap-2">
                      {unit.owners.map((owner) => (
                        <li key={owner.ownershipId} className="flex flex-col">
                          <span className="flex flex-wrap items-center gap-2">
                            <OwnerName owner={owner} />
                            {owner.isContact && <Badge tone="accent">{tu('contact')}</Badge>}
                          </span>
                          <ShareText share={owner.share} note={owner.shareNote} />
                          {owner.user && (
                            <span className="text-sm whitespace-nowrap">{owner.user.phone}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {unit.owners.length === 0 && (
                      <span className="text-gray-600">{t('noOwners')}</span>
                    )}
                    {!unit.hasContact && (
                      <div className="mt-2">
                        <NoContactBadge />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {unit.tariffCategory ? tu(`categories.${unit.tariffCategory}`) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {t('areaValue', { area: Number(unit.areaM2) })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination path="/admin/units" query={query} page={page} pageCount={result.pageCount} />
    </div>
  );
}
