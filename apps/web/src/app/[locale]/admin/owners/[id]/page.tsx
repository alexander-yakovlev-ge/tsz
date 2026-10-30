import { formatPhone, ownerName, type OwnerDetail, type UserListItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { RegistryName, ShareText, UnitName } from '@/components/registry';
import { Badge, Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { AccountLink } from './account-link';
import { NoteForm } from './note-form';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminOwners' });
  return { title: t('editTitle') };
}

/** Карточка собственника (ТЗ п. 8.12). Номера документов видит только администратор. */
export default async function OwnerPage({ params }: Props) {
  const { id } = await params;
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, tu, ownerResult, usersResult] = await Promise.all([
    getTranslations('adminOwners'),
    getTranslations('units'),
    apiGet<{ owner: OwnerDetail }>(`/api/owners/${encodeURIComponent(id)}`),
    apiGet<{ users: UserListItem[] }>('/api/users'),
  ]);
  if (!ownerResult) {
    notFound();
  }
  const { owner } = ownerResult;
  const users = (usersResult?.users ?? []).filter((user) => user.id !== owner.user?.id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/owners" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <div className="flex flex-col gap-2">
        <PageTitle>
          <RegistryName name={ownerName(owner)} />
        </PageTitle>
        <span className="flex flex-wrap items-center gap-2 text-gray-600">
          <Badge>{tu(`ownerKinds.${owner.kind}`)}</Badge>
          {owner.displayName && (
            <span>
              <RegistryName name={owner.registryName} />
            </span>
          )}
        </span>
      </div>

      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('unitsTitle')}</h2>
        {owner.units.length === 0 ? (
          <p className="text-gray-600">{t('noUnitsShort')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {owner.units.map((unit) => (
              <li key={unit.ownershipId} className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/units/${unit.unitId}`}
                  className="font-bold text-accent underline-offset-4 hover:underline"
                >
                  <UnitName kind={unit.kind} number={unit.number} />
                </Link>
                <ShareText share={unit.share} note={unit.shareNote} />
                {unit.isContact && <Badge tone="accent">{tu('contact')}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('accountTitle')}</h2>
        <AccountLink owner={owner} users={users} />
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('dataTitle')}</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="text-gray-600">{t('kind')}</dt>
          <dd>{tu(`ownerKinds.${owner.kind}`)}</dd>
          <dt className="text-gray-600">{t('registryName')}</dt>
          <dd>
            <RegistryName name={owner.registryName} />
          </dd>
          <dt className="text-gray-600">{t('displayName')}</dt>
          <dd>{owner.displayName ?? '—'}</dd>
          <dt className="text-gray-600">{t('phone')}</dt>
          <dd className="tabular-nums">{owner.phone ? formatPhone(owner.phone) : '—'}</dd>
          <dt className="text-gray-600">{t('idNumbers')}</dt>
          <dd className="tabular-nums">{owner.idNumbers.join(', ') || '—'}</dd>
        </dl>
        <p className="mt-4 text-sm text-gray-600">{t('registryHint')}</p>
        <div className="mt-6 border-t border-gray-100 pt-6">
          <NoteForm owner={owner} />
        </div>
      </Card>
    </div>
  );
}
