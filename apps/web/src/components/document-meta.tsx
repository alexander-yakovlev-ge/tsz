'use client';

import type { DocumentItem } from '@tsz/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from './ui';

const FORMATS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

/** Размер файла: КБ до мегабайта, дальше МБ с одним знаком. */
export function useFileSize() {
  const format = useFormatter();
  return (bytes: number) =>
    bytes < 1024 * 1024
      ? format.number(Math.max(1, Math.round(bytes / 1024)), { style: 'unit', unit: 'kilobyte' })
      : format.number(bytes / 1024 / 1024, {
          style: 'unit',
          unit: 'megabyte',
          maximumFractionDigits: 1,
        });
}

/** Дата загрузки, размер и формат документа (ТЗ п. 6.3). */
export function DocumentMeta({
  document,
}: {
  document: Pick<DocumentItem, 'createdAt' | 'fileSize' | 'mimeType'>;
}) {
  const format = useFormatter();
  const fileSize = useFileSize();
  return (
    <span className="text-sm text-gray-600">
      <time dateTime={document.createdAt}>
        {format.dateTime(new Date(document.createdAt), { dateStyle: 'medium' })}
      </time>
      {' · '}
      {fileSize(document.fileSize)}
      {' · '}
      {FORMATS[document.mimeType] ?? document.mimeType}
    </span>
  );
}

/** Значок доступа: OWNERS и PRIVATE помечены (ТЗ п. 6.3). PUBLIC без значка, если не full. */
export function VisibilityBadge({
  visibility,
  full = false,
}: {
  visibility: DocumentItem['visibility'];
  full?: boolean;
}) {
  const t = useTranslations('documents.visibility');
  if (visibility === 'PUBLIC') {
    return full ? <Badge>{t('PUBLIC')}</Badge> : null;
  }
  return <Badge tone={visibility === 'PRIVATE' ? 'red' : 'amber'}>{t(visibility)}</Badge>;
}
