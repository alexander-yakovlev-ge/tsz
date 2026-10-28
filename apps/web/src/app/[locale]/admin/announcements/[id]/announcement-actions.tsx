'use client';

import type { AnnouncementItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { buttonClass, FormStatusAlert } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Снятие с публикации и возврат, удаление (ТЗ п. 8.5). */
export function AnnouncementActions({ announcement }: { announcement: AnnouncementItem }) {
  const t = useTranslations('adminAnnouncements');
  const router = useRouter();
  const form = useApiForm();
  const archived = announcement.archivedAt !== null;

  async function toggleArchived() {
    const { id, status, archivedAt, ...fields } = announcement;
    const result = await form.submit(() =>
      apiRequest('PUT', `/api/announcements/${announcement.id}`, {
        ...fields,
        archived: !archived,
      }),
    );
    if (result) {
      router.refresh();
    }
  }

  async function remove() {
    if (!window.confirm(t('deleteConfirm'))) {
      return;
    }
    const result = await form.submit(() =>
      apiRequest('DELETE', `/api/announcements/${announcement.id}`),
    );
    if (result) {
      router.push('/admin/announcements');
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormStatusAlert status={form.status} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={toggleArchived}
          className={buttonClass.secondary}
          disabled={form.pending}
        >
          {archived ? t('restore') : t('archive')}
        </button>
        <button
          type="button"
          onClick={remove}
          className={buttonClass.danger}
          disabled={form.pending}
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
