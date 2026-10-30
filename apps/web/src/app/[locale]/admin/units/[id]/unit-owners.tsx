'use client';

import { formatPhone, type UnitItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { NoContactBadge, OwnerName, ShareText } from '@/components/registry';
import { Badge } from '@/components/ui';
import { Link } from '@/i18n/navigation';

/** Собственники помещения по выписке: доля, контактное лицо, учётная запись (ТЗ п. 8.1). */
export function UnitOwners({ unit }: { unit: UnitItem }) {
  const t = useTranslations('adminUnits');
  const tu = useTranslations('units');

  return (
    <div className="flex flex-col gap-4">
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
            <li key={owner.ownershipId} className="flex flex-col gap-1 px-5 py-4">
              <Link
                href={`/admin/owners/${owner.ownerId}`}
                className="font-bold text-accent underline-offset-4 hover:underline"
              >
                <OwnerName owner={owner} />
              </Link>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {owner.ownerKind === 'COMPANY' && <Badge>{tu('ownerKinds.COMPANY')}</Badge>}
                {owner.isContact && <Badge tone="accent">{tu('contact')}</Badge>}
                <ShareText share={owner.share} note={owner.shareNote} />
                {owner.user ? (
                  <span>{owner.user.phone}</span>
                ) : (
                  <span className="text-gray-600">
                    {t('noAccount')}
                    {owner.phone && (
                      <> · {t('registryPhone', { phone: formatPhone(owner.phone) })}</>
                    )}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-gray-600">{t('registryHint')}</p>
    </div>
  );
}
