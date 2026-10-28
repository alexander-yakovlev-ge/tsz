'use client';

import { ContactInfo, formatPhone } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent } from 'react';
import { LocalizedFields, readLocalized } from '@/components/localized-fields';
import { buttonClass, Fieldset, FormStatusAlert, TextField } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Контакты (ТЗ п. 8.7): телефоны нормализуются в E.164, ссылки на каналы необязательные. */
export function ContactsForm({ contacts }: { contacts: ContactInfo }) {
  const t = useTranslations('adminContacts');
  const tf = useTranslations('form');
  const router = useRouter();
  const form = useApiForm();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = {
      ...readLocalized(data, ['chairmanName', 'contactPersonName']),
      chairmanPhone: data.get('chairmanPhone'),
      contactPersonPhone: data.get('contactPersonPhone'),
      telegramUrl: data.get('telegramUrl'),
      whatsappUrl: data.get('whatsappUrl'),
    };
    const result = await form.submit(() => apiRequest('PUT', '/api/contacts', body));
    if (result) {
      form.setStatus({ kind: 'success', text: tf('saved') });
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormStatusAlert status={form.status} />
      <Fieldset legend={t('phones')}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="chairmanPhone"
            label={t('chairmanPhone')}
            hint={t('phoneHint')}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={formatPhone(contacts.chairmanPhone)}
            error={form.fields.chairmanPhone}
            required
          />
          <TextField
            id="contactPersonPhone"
            label={t('contactPersonPhone')}
            hint={t('phoneHint')}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={formatPhone(contacts.contactPersonPhone)}
            error={form.fields.contactPersonPhone}
            required
          />
        </div>
      </Fieldset>
      <LocalizedFields
        fields={[
          { name: 'chairmanName', label: t('chairmanName'), maxLength: 200 },
          { name: 'contactPersonName', label: t('contactPersonName'), maxLength: 200 },
        ]}
        values={contacts}
        errors={form.fields}
      />
      <Fieldset legend={t('channels')}>
        <TextField
          id="whatsappUrl"
          label={t('whatsappUrl')}
          hint={t('whatsappUrlHint')}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://whatsapp.com/channel/…"
          defaultValue={contacts.whatsappUrl ?? ''}
          error={form.fields.whatsappUrl}
        />
        <TextField
          id="telegramUrl"
          label={t('telegramUrl')}
          hint={t('telegramUrlHint')}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://t.me/…"
          defaultValue={contacts.telegramUrl ?? ''}
          error={form.fields.telegramUrl}
        />
      </Fieldset>
      <div>
        <button type="submit" className={buttonClass.primary} disabled={form.pending}>
          {form.pending ? tf('saving') : tf('save')}
        </button>
      </div>
    </form>
  );
}
