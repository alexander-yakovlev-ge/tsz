'use client';

import {
  displayUnitNumber,
  formatShare,
  latinName,
  ownerName,
  type Share,
  type UnitKind,
} from '@tsz/shared';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from './ui';

/** Подпись помещения: «Квартира 45», «Машиноместо 12»; на ru/en буква транслитерируется (ТЗ п. 7.1). */
export function UnitName({ kind, number }: { kind: UnitKind; number: string }) {
  const t = useTranslations('units');
  const locale = useLocale();
  return <>{t(`label.${kind}`, { number: displayUnitNumber(number, locale) })}</>;
}

/** Доля и пояснение: «1/4 · совместно с …». Без доли — ничего. */
export function ShareText({ share, note }: { share: Share | null; note: string | null }) {
  const text = [formatShare(share), note].filter(Boolean).join(' · ');
  return text ? <span className="text-sm text-gray-600">{text}</span> : null;
}

/** Имя из реестра; на ru/en после грузинского написания — латинская транслитерация. */
export function RegistryName({ name }: { name: string }) {
  const locale = useLocale();
  const latin = locale === 'ka' ? null : latinName(name);
  return (
    <>
      <span lang="ka">{name}</span>
      {latin && <span className="font-normal text-gray-600"> ({latin})</span>}
    </>
  );
}

/** Имя собственника: отображаемое, под ним — реестровое, если они различаются (ТЗ п. 4.3). */
export function OwnerName({
  owner,
}: {
  owner: { registryName: string; displayName: string | null };
}) {
  return (
    <span className="flex flex-col">
      <span>
        <RegistryName name={ownerName(owner)} />
      </span>
      {owner.displayName && (
        <span className="text-sm text-gray-600">
          <RegistryName name={owner.registryName} />
        </span>
      )}
    </span>
  );
}

export function NoContactBadge() {
  const t = useTranslations('units');
  return <Badge tone="amber">{t('noContact')}</Badge>;
}
