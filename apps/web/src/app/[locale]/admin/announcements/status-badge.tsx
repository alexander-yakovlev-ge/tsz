import type { AnnouncementStatus } from '@tsz/shared';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui';

const TONES = { SCHEDULED: 'amber', PUBLISHED: 'accent', ARCHIVED: 'gray' } as const;

/** «Запланировано» / «Опубликовано» / «Снято» (ТЗ п. 8.5). */
export async function StatusBadge({ status }: { status: AnnouncementStatus }) {
  const t = await getTranslations('adminAnnouncements.statuses');
  return <Badge tone={TONES[status]}>{t(status)}</Badge>;
}
