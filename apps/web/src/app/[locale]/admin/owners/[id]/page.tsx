import { ownerName, type OwnerDetail, type UserListItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DeleteButton } from '@/components/delete-button';
import { ShareText, UnitName } from '@/components/registry';
import { Badge, Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { OwnerForm } from '../owner-form';
import { AccountLink } from './account-link';
import { MergeOwner } from './merge-owner';

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
        <PageTitle>{ownerName(owner)}</PageTitle>
        <span className="flex flex-wrap items-center gap-2 text-gray-600">
          <Badge>{tu(`ownerKinds.${owner.kind}`)}</Badge>
          {owner.displayName && <span lang="ka">{owner.registryName}</span>}
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
        <OwnerForm owner={owner} />
      </Card>

      <Card>
        <h2 className="mb-2 text-xl font-bold">{t('mergeTitle')}</h2>
        <p className="mb-4 text-sm text-gray-600">{t('mergeHint')}</p>
        <MergeOwner owner={owner} />
      </Card>

      <Card className="border-red-200">
        <h2 className="mb-2 text-xl font-bold">{t('deleteTitle')}</h2>
        <p className="mb-4 text-sm text-gray-600">{t('deleteHint')}</p>
        <DeleteButton
          path={`/api/owners/${owner.id}`}
          confirm={t('deleteConfirm', { name: ownerName(owner) })}
          label={t('delete')}
          redirectTo="/admin/owners"
        />
      </Card>
    </div>
  );
}
