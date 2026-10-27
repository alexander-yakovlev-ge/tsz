'use client';

import type { SessionUser } from '@tsz/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Alert, buttonClass, TextField } from '@/components/ui';
import { apiRequest } from '@/lib/client-api';
import { useApiErrors } from '@/lib/use-api-errors';

export function LoginForm({ callbackUrl }: { callbackUrl: string | null }) {
  const t = useTranslations('login');
  const locale = useLocale();
  const router = useRouter();
  const errors = useApiErrors();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await apiRequest<{ user: SessionUser }>('POST', '/api/auth/login', {
      phone: form.get('phone'),
      password: form.get('password'),
    });
    if (!result.ok) {
      setPending(false);
      setError(errors.message(result));
      return;
    }
    const fallback = result.data.user.role === 'ADMIN' ? `/${locale}/admin` : `/${locale}/account`;
    // callbackUrl уже содержит префикс языка, поэтому переход — через next/navigation.
    router.replace(callbackUrl ?? fallback);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {error && <Alert kind="error">{error}</Alert>}
      <TextField
        id="phone"
        label={t('phone')}
        hint={t('phoneHint')}
        type="tel"
        autoComplete="username"
        inputMode="tel"
        required
      />
      <TextField
        id="password"
        label={t('password')}
        type="password"
        autoComplete="current-password"
        required
      />
      <button type="submit" className={buttonClass.primary} disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
