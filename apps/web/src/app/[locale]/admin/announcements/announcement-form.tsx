'use client';

import { AnnouncementItem, fromTbilisiLocal, toTbilisiLocal } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { LocalizedFields, readLocalized } from '@/components/localized-fields';
import { buttonClass, CheckboxField, FormStatusAlert, TextField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/**
 * Создание (announcement не задан) и редактирование объявления (ТЗ п. 8.5).
 * Дата публикации вводится по времени Тбилиси. Флажок push появится на этапе 6.
 */
export function AnnouncementForm({
  announcement,
  defaultPublishedAt,
}: {
  announcement?: AnnouncementItem;
  /** Значение datetime-local «сейчас», посчитанное на сервере */
  defaultPublishedAt: string;
}) {
  const t = useTranslations('adminAnnouncements');
  const tf = useTranslations('form');
  const router = useRouter();
  const form = useApiForm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      ...readLocalized(data, ['title', 'body']),
      isPinned: data.get('isPinned') === 'on',
      publishedAt: fromTbilisiLocal(String(data.get('publishedAt') ?? '')),
      ...(announcement ? { archived: announcement.archivedAt !== null } : {}),
    };
    const result = await form.submit(() =>
      announcement
        ? apiRequest<{ announcement: AnnouncementItem }>(
            'PUT',
            `/api/announcements/${announcement.id}`,
            body,
          )
        : apiRequest<{ announcement: AnnouncementItem }>('POST', '/api/announcements', body),
    );
    if (!result) {
      return;
    }
    if (announcement) {
      form.setStatus({ kind: 'success', text: tf('saved') });
      router.refresh();
    } else {
      router.push(`/admin/announcements/${result.data.announcement.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormStatusAlert status={form.status} />
      <LocalizedFields
        fields={[
          { name: 'title', label: t('titleField'), maxLength: 200 },
          { name: 'body', label: t('bodyField'), markdown: true },
        ]}
        values={announcement}
        errors={form.fields}
      />
      <TextField
        id="publishedAt"
        label={t('publishedAt')}
        hint={t('publishedAtHint')}
        type="datetime-local"
        defaultValue={announcement ? toTbilisiLocal(announcement.publishedAt) : defaultPublishedAt}
        error={form.fields.publishedAt}
        required
      />
      <CheckboxField
        id="isPinned"
        label={t('pin')}
        hint={t('pinHint')}
        defaultChecked={announcement?.isPinned ?? false}
      />
      <div>
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {announcement
            ? form.pending
              ? tf('saving')
              : tf('save')
            : form.pending
              ? tf('creating')
              : t('create')}
        </button>
      </div>
    </form>
  );
}
