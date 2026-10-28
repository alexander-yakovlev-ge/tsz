'use client';

import { formatShare, type UnitItem, type UnitOwnerItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { OwnerSearch } from '@/components/owner-search';
import { NoContactBadge, OwnerName } from '@/components/registry';
import { Badge, buttonClass, CheckboxField, FormStatusAlert, TextField } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

function OwnershipRow({ unitId, owner }: { unitId: string; owner: UnitOwnerItem }) {
  const t = useTranslations('adminUnits');
  const tu = useTranslations('units');
  const router = useRouter();
  const form = useApiForm();
  const prefix = `ownership-${owner.ownershipId}`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await form.submit(() =>
      apiRequest('PUT', `/api/units/${unitId}/ownerships/${owner.ownershipId}`, {
        share: data.get(`${prefix}-share`),
        shareNote: data.get(`${prefix}-note`),
        isContact: data.get(`${prefix}-contact`) === 'on',
      }),
    );
    if (result) {
      form.setStatus({ kind: 'success', text: t('saved') });
      router.refresh();
    }
  }

  async function unlink() {
    if (!window.confirm(t('unlinkConfirm', { name: owner.displayName ?? owner.registryName }))) {
      return;
    }
    if (
      await form.submit(() =>
        apiRequest('DELETE', `/api/units/${unitId}/ownerships/${owner.ownershipId}`),
      )
    ) {
      router.refresh();
    }
  }

  return (
    <li className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href={`/admin/owners/${owner.ownerId}`}
            className="font-bold text-accent underline-offset-4 hover:underline"
          >
            <OwnerName owner={owner} />
          </Link>
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {owner.ownerKind === 'COMPANY' && <Badge>{tu('ownerKinds.COMPANY')}</Badge>}
            {owner.isContact && <Badge tone="accent">{tu('contact')}</Badge>}
            {owner.user ? (
              <span>{owner.user.phone}</span>
            ) : (
              <span className="text-gray-600">{t('noAccount')}</span>
            )}
          </span>
        </div>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <FormStatusAlert status={form.status} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`${prefix}-share`}
            label={t('share')}
            hint={t('shareHint')}
            defaultValue={formatShare(owner.share)}
            error={form.fields.share}
          />
          <TextField
            id={`${prefix}-note`}
            label={t('shareNote')}
            defaultValue={owner.shareNote ?? ''}
            error={form.fields.shareNote}
          />
        </div>
        <CheckboxField
          id={`${prefix}-contact`}
          label={t('isContact')}
          hint={t('isContactHint')}
          defaultChecked={owner.isContact}
        />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonClass.secondary} disabled={form.pending}>
            {t('save')}
          </button>
          <button
            type="button"
            onClick={unlink}
            className={buttonClass.secondary}
            disabled={form.pending}
          >
            {t('unlink')}
          </button>
        </div>
      </form>
    </li>
  );
}

/** Собственники помещения: доля, контактное лицо, привязка и отвязка (ТЗ п. 8.1). */
export function OwnershipsEditor({ unit }: { unit: UnitItem }) {
  const t = useTranslations('adminUnits');
  const router = useRouter();
  const form = useApiForm();

  async function add(ownerId: string) {
    const result = await form.submit(() =>
      apiRequest('POST', `/api/units/${unit.id}/ownerships`, {
        ownerId,
        isContact: unit.owners.length === 0,
      }),
    );
    if (result) {
      form.setStatus({ kind: 'success', text: t('ownerAdded') });
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!unit.hasContact && (
        <div>
          <NoContactBadge />
        </div>
      )}
      {unit.owners.length === 0 ? (
        <p className="text-gray-600">{t('noOwners')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200">
          {unit.owners.map((owner) => (
            <OwnershipRow key={owner.ownershipId} unitId={unit.id} owner={owner} />
          ))}
        </ul>
      )}
      <FormStatusAlert status={form.status} />
      <OwnerSearch
        id="add-owner"
        label={t('addOwner')}
        actionLabel={t('addOwnerAction')}
        exclude={unit.owners.map((owner) => owner.ownerId)}
        onSelect={(owner) => add(owner.id)}
      />
      <p className="text-sm text-gray-600">
        {t.rich('newOwnerHint', {
          link: (chunks) => (
            <Link href="/admin/owners/new" className="font-semibold text-accent hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
