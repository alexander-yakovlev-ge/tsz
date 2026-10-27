'use client';

import { useTranslations } from 'next-intl';

/** Сгенерированный пароль показывается один раз (ТЗ п. 8.2). */
export function TemporaryPassword({ password }: { password: string }) {
  const t = useTranslations('users');
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
    >
      <span className="font-semibold text-emerald-900">{t('temporaryPassword')}</span>
      <output
        data-testid="temporary-password"
        className="font-mono text-2xl font-bold tracking-wider select-all"
      >
        {password}
      </output>
      <span className="text-sm text-emerald-900">{t('temporaryPasswordNote')}</span>
    </div>
  );
}
