'use client';

import type { HomePageContent } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { LocalizedFields, readLocalized } from '@/components/localized-fields';
import { buttonClass, FormStatusAlert } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Главная страница (ТЗ п. 8.8): название, адрес, приветствие в Markdown с предпросмотром. */
export function HomeForm({ home }: { home: HomePageContent }) {
  const t = useTranslations('adminHome');
  const tf = useTranslations('form');
  const router = useRouter();
  const form = useApiForm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = readLocalized(new FormData(event.currentTarget), ['name', 'address', 'intro']);
    const result = await form.submit(() => apiRequest('PUT', '/api/home', body));
    if (result) {
      form.setStatus({ kind: 'success', text: tf('saved') });
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormStatusAlert status={form.status} />
      <LocalizedFields
        fields={[
          { name: 'name', label: t('name'), maxLength: 200 },
          { name: 'address', label: t('address'), maxLength: 300 },
          { name: 'intro', label: t('greeting'), markdown: true },
        ]}
        values={home}
        errors={form.fields}
      />
      <div>
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {form.pending ? tf('saving') : tf('save')}
        </button>
      </div>
    </form>
  );
}
