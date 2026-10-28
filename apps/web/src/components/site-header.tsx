import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { apiGet, getSession } from '@/lib/api';
import { LanguageSwitcher } from './language-switcher';
import { LogoutButton } from './logout-button';
import { NavLink } from './nav-link';

/**
 * Шапка сайта. overlay — поверх фото на главной, иначе тёмная полоса.
 * В меню только работающие разделы (ТЗ v1.7): остальные появятся по мере готовности этапов.
 */
export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [t, user] = await Promise.all([getTranslations(), getSession()]);
  // Бейдж непрочитанных объявлений — только для вошедших (ТЗ п. 6.2).
  const unread = user ? await apiGet<{ count: number }>('/api/me/announcements/unread') : null;

  return (
    <header className={overlay ? 'relative text-white' : 'bg-ink text-white'}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-white"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="6" y="2" width="12" height="20" rx="1" />
            <path d="M10 6h1M13 6h1M10 10h1M13 10h1M10 14h1M13 14h1M11 22v-4h2v4" />
          </svg>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight">{t('meta.siteName')}</span>
            <span className="text-xs text-gray-300">{t('brand.tagline')}</span>
          </span>
        </Link>

        <nav
          aria-label={t('nav.main')}
          className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto sm:flex-1"
        >
          <NavLink href="/" exact>
            {t('nav.home')}
          </NavLink>
          <NavLink
            href="/announcements"
            badge={
              unread
                ? { count: unread.count, label: t('nav.unread', { count: unread.count }) }
                : undefined
            }
          >
            {t('nav.announcements')}
          </NavLink>
          <NavLink href="/documents">{t('nav.documents')}</NavLink>
          <NavLink href="/contacts">{t('nav.contacts')}</NavLink>
          {user && <NavLink href="/account">{t('nav.account')}</NavLink>}
          {user?.role === 'ADMIN' && <NavLink href="/admin">{t('nav.admin')}</NavLink>}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher label={t('nav.language')} />
          {user ? (
            <LogoutButton label={t('nav.logout')} />
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-bold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-white"
            >
              {t('nav.login')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
