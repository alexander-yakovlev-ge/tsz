'use client';

import type { OwnerDetail, TemporaryPasswordResponse, UserListItem } from '@tsz/shared';
import { useTranslations } from 'next-intl';
import { FormEvent, useState } from 'react';
import { buttonClass, FormStatusAlert, SelectField, TextField } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';
import { TemporaryPassword } from '../../users/temporary-password';

/**
 * Учётная запись собственника (ТЗ п. 8.12): привязать существующую, создать новую
 * (временный пароль показывается один раз) или отвязать.
 */
export function AccountLink({ owner, users }: { owner: OwnerDetail; users: UserListItem[] }) {
  const t = useTranslations('adminOwners');
  const tl = useTranslations('users');
  const router = useRouter();
  const form = useApiForm();
  const [mode, setMode] = useState<'existing' | 'new'>(users.length > 0 ? 'existing' : 'new');
  const [password, setPassword] = useState<string | null>(null);

  async function link(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body =
      mode === 'existing'
        ? { mode, userId: data.get('userId') }
        : {
            mode,
            phone: data.get('phone'),
            language: data.get('language'),
            ...(data.get('password') ? { password: data.get('password') } : {}),
          };
    const result = await form.submit(() =>
      apiRequest<{ owner: OwnerDetail } & TemporaryPasswordResponse>(
        'PUT',
        `/api/owners/${owner.id}/user`,
        body,
      ),
    );
    if (result) {
      setPassword(result.data.temporaryPassword ?? null);
      form.setStatus({ kind: 'success', text: t('linked') });
      router.refresh();
    }
  }

  async function unlink() {
    if (!window.confirm(t('unlinkConfirm'))) {
      return;
    }
    if (await form.submit(() => apiRequest('DELETE', `/api/owners/${owner.id}/user`))) {
      setPassword(null);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <FormStatusAlert status={form.status} />
      {password && <TemporaryPassword password={password} />}
      {owner.user ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/admin/users/${owner.user.id}`}
            className="font-bold text-accent underline-offset-4 hover:underline"
          >
            {owner.user.phone}
          </Link>
          <button
            type="button"
            onClick={unlink}
            className={buttonClass.secondary}
            disabled={form.pending}
          >
            {t('unlink')}
          </button>
        </div>
      ) : (
        <p className="text-gray-600">{t('noAccountHint')}</p>
      )}

      <form onSubmit={link} className="flex flex-col gap-4" noValidate>
        <h3 className="font-bold">{owner.user ? t('replaceAccount') : t('linkAccount')}</h3>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="sr-only">{t('linkMode')}</legend>
          {(['existing', 'new'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                disabled={value === 'existing' && users.length === 0}
                className="size-5 accent-accent"
              />
              {t(`modes.${value}`)}
            </label>
          ))}
        </fieldset>
        {mode === 'existing' ? (
          <SelectField
            id="userId"
            label={t('existingUser')}
            error={form.fields.userId}
            options={users.map((user) => ({
              value: user.id,
              label: user.name ? `${user.phone} · ${user.name}` : user.phone,
            }))}
          />
        ) : (
          <>
            <TextField
              id="phone"
              label={tl('phone')}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              error={form.fields.phone}
              required
            />
            <SelectField
              id="language"
              label={tl('language')}
              defaultValue="ka"
              error={form.fields.language}
              options={routing.locales.map((locale) => ({
                value: locale,
                label: tl(`languages.${locale}`),
              }))}
            />
            <TextField
              id="password"
              label={tl('password')}
              hint={tl('passwordHint')}
              type="text"
              autoComplete="off"
              error={form.fields.password}
            />
          </>
        )}
        <div>
          <button type="submit" className={buttonClass.primary} disabled={form.pending}>
            {mode === 'existing' ? t('linkExisting') : t('createAndLink')}
          </button>
        </div>
      </form>
    </div>
  );
}
