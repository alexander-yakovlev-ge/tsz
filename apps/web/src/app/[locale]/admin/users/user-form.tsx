'use client';

import type { TemporaryPasswordResponse, UserListItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { Alert, buttonClass, SelectField, TextField } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { apiRequest } from '@/lib/client-api';
import { useApiErrors } from '@/lib/use-api-errors';
import { TemporaryPassword } from './temporary-password';

type Status = { kind: 'error' | 'success'; text: string } | null;

/** Создание (user не задан) и редактирование пользователя (ТЗ п. 8.2). */
export function UserForm({ user, isSelf = false }: { user?: UserListItem; isSelf?: boolean }) {
  const t = useTranslations('users');
  const router = useRouter();
  const errors = useApiErrors();
  const [status, setStatus] = useState<Status>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ id: string; temporaryPassword: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      phone: form.get('phone'),
      name: form.get('name'),
      role: isSelf ? 'ADMIN' : form.get('role'),
      language: form.get('language'),
      ...(user ? {} : form.get('password') ? { password: form.get('password') } : {}),
    };
    setPending(true);
    setStatus(null);
    const result = user
      ? await apiRequest<{ user: UserListItem }>('PUT', `/api/users/${user.id}`, body)
      : await apiRequest<{ user: UserListItem } & TemporaryPasswordResponse>(
          'POST',
          '/api/users',
          body,
        );
    setPending(false);
    if (!result.ok) {
      setStatus({ kind: 'error', text: errors.message(result) });
      setFields(errors.fields(result));
      return;
    }
    setFields({});
    if (user) {
      setStatus({ kind: 'success', text: t('saved') });
      router.refresh();
      return;
    }
    const data = result.data as { user: UserListItem } & TemporaryPasswordResponse;
    if (data.temporaryPassword) {
      setCreated({ id: data.user.id, temporaryPassword: data.temporaryPassword });
    } else {
      router.push('/admin/users');
      router.refresh();
    }
  }

  if (created) {
    return (
      <div className="flex flex-col gap-5">
        <TemporaryPassword password={created.temporaryPassword} />
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/users/${created.id}`} className={buttonClass.secondary}>
            {t('editTitle')}
          </Link>
          <Link href="/admin/users" className={buttonClass.primary}>
            {t('toList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {status && <Alert kind={status.kind}>{status.text}</Alert>}
      <TextField
        id="phone"
        label={t('phone')}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        defaultValue={user?.phone}
        error={fields.phone}
        required
      />
      <TextField
        id="name"
        label={t('name')}
        autoComplete="off"
        defaultValue={user?.name ?? ''}
        error={fields.name}
      />
      <SelectField
        id="role"
        label={t('role')}
        defaultValue={user?.role ?? 'RESIDENT'}
        disabled={isSelf}
        hint={isSelf ? t('selfRoleNote') : undefined}
        error={fields.role}
        options={[
          { value: 'RESIDENT', label: t('roles.RESIDENT') },
          { value: 'ADMIN', label: t('roles.ADMIN') },
        ]}
      />
      <SelectField
        id="language"
        label={t('language')}
        defaultValue={user?.language ?? 'ka'}
        error={fields.language}
        options={routing.locales.map((locale) => ({
          value: locale,
          label: t(`languages.${locale}`),
        }))}
      />
      {!user && (
        <TextField
          id="password"
          label={t('password')}
          hint={t('passwordHint')}
          type="text"
          autoComplete="off"
          error={fields.password}
        />
      )}
      <div>
        <button type="submit" className={buttonClass.primary} disabled={pending}>
          {user ? (pending ? t('saving') : t('save')) : pending ? t('creating') : t('create')}
        </button>
      </div>
    </form>
  );
}
