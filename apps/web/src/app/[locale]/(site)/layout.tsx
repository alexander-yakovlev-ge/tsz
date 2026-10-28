import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';

/** Обычные страницы: тёмная шапка и колонка контента. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
    </>
  );
}
