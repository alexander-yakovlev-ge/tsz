'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, buttonClass } from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiErrors } from '@/lib/use-api-errors';

export function DeleteUserButton({ userId, phone }: { userId: string; phone: string }) {
  const t = useTranslations('users');
  const router = useRouter();
  const errors = useApiErrors();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(t('deleteConfirm', { phone }))) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await apiRequest('DELETE', `/api/users/${userId}`);
    if (!result.ok) {
      setPending(false);
      setError(errors.message(result));
      return;
    }
    router.push('/admin/users');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert kind="error">{error}</Alert>}
      <div>
        <button type="button" onClick={remove} className={buttonClass.danger} disabled={pending}>
          {t('delete')}
        </button>
      </div>
    </div>
  );
}
