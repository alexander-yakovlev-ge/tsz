'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/client-api';

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await apiRequest('POST', '/api/auth/logout');
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-full border border-white/50 px-5 font-bold text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-60"
    >
      {label}
    </button>
  );
}
