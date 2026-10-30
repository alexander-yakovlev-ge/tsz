import { formatPhone, OWNER_KINDS, type OwnerItem, type OwnerKind, type Page } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Pagination } from '@/components/pagination';
import { NoContactBadge, OwnerName, ShareText, UnitName } from '@/components/registry';
import { buttonClass, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';

interface Props {
  params: LocaleParams;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminOwners' });
  return { title: t('title') };
}

const filterClass =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-base focus:border-accent focus:outline-2 focus:outline-accent/30';

/** Раздел «Собственники» (ТЗ п. 8.12): поиск, фильтры, по 50 на странице. */
export default async function AdminOwnersPage({ params, searchParams }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const search = await searchParams;
  const query = {
    q: search.q?.trim() || undefined,
    kind: OWNER_KINDS.includes(search.kind as OwnerKind) ? search.kind : undefined,
    noUser: search.noUser === 'true' ? 'true' : undefined,
    noUnits: search.noUnits === 'true' ? 'true' : undefined,
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
    getTranslations('adminOwners'),
    getTranslations('units'),
    apiGet<Page<OwnerItem>>(`/api/owners?${apiQuery}`),
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
            {OWNER_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {tu(`ownerKinds.${kind}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-2 pb-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="noUser"
              value="true"
              defaultChecked={!!query.noUser}
              className="size-5 accent-accent"
            />
            {t('noUser')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="noUnits"
              value="true"
              defaultChecked={!!query.noUnits}
              className="size-5 accent-accent"
            />
            {t('noUnits')}
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
                  {t('name')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('kind')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('units')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('account')}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((owner) => (
                <tr key={owner.id} className="border-b border-gray-100 align-top last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/owners/${owner.id}`}
                      className="font-bold text-accent underline-offset-4 hover:underline"
                    >
                      <OwnerName owner={owner} />
                    </Link>
                  </td>
                  <td className="px-4 py-3">{tu(`ownerKinds.${owner.kind}`)}</td>
                  <td className="px-4 py-3">
                    {owner.units.length === 0 ? (
                      <span className="text-gray-600">{t('noUnitsShort')}</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {owner.units.map((unit) => (
                          <li key={unit.ownershipId} className="flex flex-col">
                            <Link
                              href={`/admin/units/${unit.unitId}`}
                              className="whitespace-nowrap underline-offset-4 hover:underline"
                            >
                              <UnitName kind={unit.kind} number={unit.number} />
                            </Link>
                            <ShareText share={unit.share} note={unit.shareNote} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {owner.user ? (
                      owner.user.phone
                    ) : (
                      <span className="flex flex-col items-start gap-1">
                        <NoContactBadge />
                        {owner.phone && (
                          <span className="text-sm text-gray-600">
                            {t('registryPhone', { phone: formatPhone(owner.phone) })}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination path="/admin/owners" query={query} page={page} pageCount={result.pageCount} />
    </div>
  );
}
