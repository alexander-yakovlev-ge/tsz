'use client';

import { buttonClass, FormStatusAlert } from './ui';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';
import { useApiForm } from '@/lib/use-api-form';

/** Удаление записи с подтверждением и переходом к списку; ошибку API (409) показывает рядом. */
export function DeleteButton({
  path,
  confirm,
  label,
  redirectTo,
}: {
  path: string;
  confirm: string;
  label: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const form = useApiForm();

  async function remove() {
    if (!window.confirm(confirm)) {
      return;
    }
    if (await form.submit(() => apiRequest('DELETE', path))) {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormStatusAlert status={form.status} />
      <div>
        <button
          type="button"
          onClick={remove}
          className={buttonClass.danger}
          disabled={form.pending}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
