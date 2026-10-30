import { displayUnitNumber, type UnitDocumentItem, type UnitItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge, Card, PageTitle } from '@/components/ui';
import { UnitDocuments } from '@/components/unit-documents';
import { Link } from '@/i18n/navigation';
import { readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { CategoryForm } from './category-form';
import { UnitOwners } from './unit-owners';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminUnits' });
  return { title: t('editTitle') };
}

/**
 * Карточка помещения (ТЗ п. 8.1): данные и собственники по выписке — только для чтения,
 * вручную — категория тарифа и документы. Операции — этап 5.
 */
export default async function UnitPage({ params }: Props) {
  const { id } = await params;
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, tu, unitResult, documentsResult] = await Promise.all([
    getTranslations('adminUnits'),
    getTranslations('units'),
    apiGet<{ unit: UnitItem }>(`/api/units/${encodeURIComponent(id)}`),
    apiGet<{ documents: UnitDocumentItem[] }>(`/api/units/${encodeURIComponent(id)}/documents`),
  ]);
  if (!unitResult) {
    notFound();
  }
  const { unit } = unitResult;
  const title = tu(`label.${unit.kind}`, { number: displayUnitNumber(unit.number, locale) });

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/admin/units" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <div className="flex flex-col gap-2">
        <PageTitle>{title}</PageTitle>
        <span className="flex flex-wrap items-center gap-2 text-gray-600">
          {unit.cadastralCode}
          {unit.status === 'ARCHIVED' && <Badge tone="amber">{t('archivedBadge')}</Badge>}
        </span>
      </div>
      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('ownersTitle')}</h2>
        <UnitOwners unit={unit} />
      </Card>
      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('dataTitle')}</h2>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="text-gray-600">{t('kind')}</dt>
          <dd>{tu(`kinds.${unit.kind}`)}</dd>
          <dt className="text-gray-600">{t('cadastralCode')}</dt>
          <dd className="tabular-nums">{unit.cadastralCode}</dd>
          <dt className="text-gray-600">{t('number')}</dt>
          <dd lang="ka">{unit.number}</dd>
          <dt className="text-gray-600">{t('floor')}</dt>
          <dd>{unit.floorLabel ?? unit.floor ?? '—'}</dd>
          <dt className="text-gray-600">{t('area')}</dt>
          <dd className="tabular-nums">{t('areaValue', { area: Number(unit.areaM2) })}</dd>
          {unit.kind !== 'APARTMENT' && (
            <>
              <dt className="text-gray-600">{t('category')}</dt>
              <dd>—</dd>
            </>
          )}
        </dl>
        <p className="mt-4 text-sm text-gray-600">{t('registryHint')}</p>
        {unit.kind === 'APARTMENT' && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <CategoryForm unit={unit} />
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('documentsTitle')}</h2>
        <UnitDocuments unitId={unit.id} documents={documentsResult?.documents ?? []} manage />
      </Card>
    </div>
  );
}
