import { displayUnitNumber, type UnitDocumentItem, type UnitItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DeleteButton } from '@/components/delete-button';
import { Badge, Card, PageTitle } from '@/components/ui';
import { UnitDocuments } from '@/components/unit-documents';
import { Link } from '@/i18n/navigation';
import { readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { UnitForm } from '../unit-form';
import { OwnershipsEditor } from './ownerships-editor';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'adminUnits' });
  return { title: t('editTitle') };
}

/** Карточка помещения (ТЗ п. 8.1): данные, собственники, документы. Операции — этап 5. */
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
          {unit.status === 'MERGED' && <Badge tone="amber">{t('mergedBadge')}</Badge>}
        </span>
      </div>
      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('ownersTitle')}</h2>
        <OwnershipsEditor unit={unit} />
      </Card>
      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('dataTitle')}</h2>
        <UnitForm unit={unit} />
      </Card>
      <Card>
        <h2 className="mb-4 text-xl font-bold">{t('documentsTitle')}</h2>
        <UnitDocuments unitId={unit.id} documents={documentsResult?.documents ?? []} manage />
      </Card>
      <Card className="border-red-200">
        <h2 className="mb-2 text-xl font-bold">{t('deleteTitle')}</h2>
        <p className="mb-4 text-sm text-gray-600">{t('deleteHint')}</p>
        <DeleteButton
          path={`/api/units/${unit.id}`}
          confirm={t('deleteConfirm', { name: title })}
          label={t('delete')}
          redirectTo="/admin/units"
        />
      </Card>
    </div>
  );
}
