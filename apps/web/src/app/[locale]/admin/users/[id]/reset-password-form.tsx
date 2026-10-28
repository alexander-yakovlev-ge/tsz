'use client';

import type { TemporaryPasswordResponse } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { Alert, buttonClass, TextField } from '@/components/ui';
import { apiRequest } from '@/lib/client-api';
import { useApiErrors } from '@/lib/use-api-errors';
import { TemporaryPassword } from '../temporary-password';

/** Сброс пароля администратором: вручную или генерацией (ТЗ п. 8.2). */
export function ResetPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations('users');
  const errors = useApiErrors();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [done, setDone] = useState<{ temporaryPassword?: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(t('resetConfirm'))) {
      return;
    }
    const formElement = event.currentTarget;
    const password = new FormData(formElement).get('newPassword');
    setPending(true);
    setError(null);
    setDone(null);
    const result = await apiRequest<TemporaryPasswordResponse>(
      'POST',
      `/api/users/${userId}/reset-password`,
      password ? { password } : {},
    );
    setPending(false);
    if (!result.ok) {
      setError({ text: errors.message(result), field: errors.fields(result).password });
      return;
    }
    formElement.reset();
    setDone(result.data);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error && <Alert kind="error">{error.text}</Alert>}
      {done &&
        (done.temporaryPassword ? (
          <TemporaryPassword password={done.temporaryPassword} />
        ) : (
          <Alert kind="success">{t('resetDone')}</Alert>
        ))}
      <TextField
        id="newPassword"
        label={t('newPassword')}
        type="text"
        autoComplete="off"
        error={error?.field}
      />
      <div>
        <button type="submit" className={buttonClass.secondary} disabled={pending}>
          {pending ? t('resetting') : t('reset')}
        </button>
      </div>
    </form>
  );
}
