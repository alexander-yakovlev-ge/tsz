'use client';

import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

/** Пункт меню с отметкой текущего раздела. */
export function NavLink({
  href,
  exact = false,
  variant = 'header',
  children,
}: {
  href: string;
  exact?: boolean;
  variant?: 'header' | 'sidebar';
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const style =
    variant === 'header'
      ? active
        ? 'font-bold text-white underline decoration-2 underline-offset-8'
        : 'text-gray-200 hover:text-white'
      : active
        ? 'bg-accent/10 font-bold text-accent-strong'
        : 'text-gray-700 hover:bg-gray-100';
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 focus-visible:outline-2 focus-visible:outline-accent ${style}`}
    >
      {children}
    </Link>
  );
}
