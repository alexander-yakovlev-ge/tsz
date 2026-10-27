import { getTranslations } from 'next-intl/server';
import { buttonClass } from '@/components/ui';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <p className="text-6xl font-extrabold text-accent">404</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('title')}</h1>
        <p className="text-gray-600">{t('text')}</p>
        <Link href="/" className={buttonClass.primary}>
          {t('home')}
        </Link>
      </main>
    </>
  );
}
