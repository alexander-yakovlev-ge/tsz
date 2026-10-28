'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { Alert, buttonClass, TextField } from '@/components/ui';
import { apiRequest } from '@/lib/client-api';
import { useApiErrors } from '@/lib/use-api-errors';

type Status = { kind: 'error' | 'success'; text: string } | null;

export function ChangePasswordForm() {
  const t = useTranslations('changePassword');
  const errors = useApiErrors();
  const [status, setStatus] = useState<Status>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setStatus(null);
    if (form.get('newPassword') !== form.get('confirmPassword')) {
      setFields({ confirmPassword: t('mismatch') });
      return;
    }
    setFields({});
    setPending(true);
    const result = await apiRequest('POST', '/api/me/password', {
      currentPassword: form.get('currentPassword'),
      newPassword: form.get('newPassword'),
    });
    setPending(false);
    if (!result.ok) {
      setStatus({ kind: 'error', text: errors.message(result) });
      setFields(errors.fields(result));
      return;
    }
    formElement.reset();
    setStatus({ kind: 'success', text: t('success') });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {status && <Alert kind={status.kind}>{status.text}</Alert>}
      <TextField
        id="currentPassword"
        label={t('current')}
        type="password"
        autoComplete="current-password"
        error={fields.currentPassword}
        required
      />
      <TextField
        id="newPassword"
        label={t('new')}
        hint={t('newHint')}
        type="password"
        autoComplete="new-password"
        error={fields.newPassword}
        required
      />
      <TextField
        id="confirmPassword"
        label={t('confirm')}
        type="password"
        autoComplete="new-password"
        error={fields.confirmPassword}
        required
      />
      <button type="submit" className={buttonClass.primary} disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
