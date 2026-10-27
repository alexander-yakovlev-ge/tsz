import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-4 py-6 text-sm text-gray-600 sm:px-6">
        <span>{t('name')}</span>
        <span>{t('address')}</span>
      </div>
    </footer>
  );
}
