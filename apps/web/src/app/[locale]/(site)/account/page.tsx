import { ownerName, type MeUnit, type MeUnits, type UnitDocumentItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShareText, UnitName } from '@/components/registry';
import { Badge, Card, PageTitle } from '@/components/ui';
import { UnitDocuments } from '@/components/unit-documents';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { DisplayNameForm } from './display-name-form';

interface Props {
  params: LocaleParams;
  searchParams: Promise<{ unit?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('title') };
}

function UnitSwitcher({ units, selected }: { units: MeUnit[]; selected: string }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {units.map((unit) => (
        <li key={unit.id}>
          <Link
            href={`/account?unit=${unit.id}`}
            aria-current={unit.id === selected ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 font-semibold ${
              unit.id === selected
                ? 'border-accent bg-accent text-white'
                : 'border-gray-300 bg-white hover:bg-gray-50'
            }`}
          >
            <UnitName kind={unit.kind} number={unit.number} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Личный кабинет (ТЗ п. 7): помещения всех собственников, к которым привязана учётная запись.
 * Баланс и история операций — этап 5.
 */
export default async function AccountPage({ params, searchParams }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, user, result] = await Promise.all([
    getTranslations('account'),
    requireUser(locale),
    apiGet<MeUnits>('/api/me/units'),
  ]);
  const owners = result?.owners ?? [];
  const units = result?.units ?? [];
  const requested = (await searchParams).unit;
  const unit = units.find((item) => item.id === requested) ?? units[0];
  const documents = unit
    ? ((await apiGet<{ documents: UnitDocumentItem[] }>(`/api/units/${unit.id}/documents`))
        ?.documents ?? [])
    : [];
  const name = user.name ?? (owners[0] ? ownerName(owners[0]) : null);
  // Представитель компании: помещения сгруппированы по собственнику (ТЗ п. 7.1).
  const groups =
    owners.length > 1
      ? owners
          .map((owner) => ({ owner, units: units.filter((u) => u.ownerIds.includes(owner.id)) }))
          .filter((group) => group.units.length > 0)
      : [];

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-lg">{name ? t('greeting', { name }) : t('greetingNoName')}</p>

      {!unit ? (
        <p className="text-gray-600">{t('noUnits')}</p>
      ) : (
        <>
          {units.length > 1 && (
            <nav aria-label={t('units')} className="flex flex-col gap-4">
              {groups.length > 1 ? (
                groups.map((group) => (
                  <div key={group.owner.id} className="flex flex-col gap-2">
                    <h2 className="font-bold">{ownerName(group.owner)}</h2>
                    <UnitSwitcher units={group.units} selected={unit.id} />
                  </div>
                ))
              ) : (
                <UnitSwitcher units={units} selected={unit.id} />
              )}
            </nav>
          )}

          <Card>
            <h2 className="mb-4 text-2xl font-bold" data-testid="unit-title">
              <UnitName kind={unit.kind} number={unit.number} />
            </h2>
            <dl className="mb-5 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="text-gray-600">{t('floor')}</dt>
              <dd>{unit.floorLabel ?? unit.floor ?? '—'}</dd>
              <dt className="text-gray-600">{t('area')}</dt>
              <dd className="tabular-nums">{t('areaValue', { area: Number(unit.areaM2) })}</dd>
            </dl>
            <h3 className="mb-2 font-bold">{t('owners')}</h3>
            <ul className="flex flex-col gap-2" data-testid="unit-owners">
              {unit.owners.map((owner, index) => (
                <li key={index} className="flex flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    {owner.name}
                    {owner.isMine && <Badge tone="accent">{t('you')}</Badge>}
                  </span>
                  <ShareText share={owner.share} note={owner.shareNote} />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-4 text-xl font-bold">{t('documents')}</h2>
            <UnitDocuments unitId={unit.id} documents={documents} />
          </Card>
        </>
      )}

      {owners.length > 0 && (
        <Card className="max-w-xl">
          <h2 className="mb-3 text-xl font-bold">{t('myData')}</h2>
          <div className="flex flex-col gap-6">
            {owners.map((owner) => (
              <DisplayNameForm key={owner.id} owner={owner} />
            ))}
          </div>
        </Card>
      )}

      <Card className="max-w-md">
        <h2 className="mb-3 text-xl font-bold">{t('security')}</h2>
        <Link
          href="/account/change-password"
          className="font-bold text-accent underline-offset-4 hover:underline"
        >
          {t('changePassword')}
        </Link>
      </Card>
    </div>
  );
}
