'use client';

import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * Пункт меню с отметкой текущего раздела. badge — число непрочитанного; в самом разделе
 * не показывается: открытие раздела и так отмечает всё прочитанным.
 */
export function NavLink({
  href,
  exact = false,
  variant = 'header',
  badge,
  children,
}: {
  href: string;
  exact?: boolean;
  variant?: 'header' | 'sidebar';
  badge?: { count: number; label: string };
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
      {badge && badge.count > 0 && !active && (
        <span data-testid="unread-badge" className="ml-1.5">
          <span
            aria-hidden="true"
            className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-ink"
          >
            {badge.count > 9 ? '9+' : badge.count}
          </span>
          <span className="sr-only">{badge.label}</span>
        </span>
      )}
    </Link>
  );
}
