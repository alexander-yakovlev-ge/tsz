import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/site-header';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';

export default async function HomePage({ params }: { params: LocaleParams }) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <section className="relative isolate flex min-h-[600px] flex-col bg-[#0b1220] text-white sm:min-h-[78vh]">
      <picture>
        <source
          type="image/webp"
          srcSet="/images/house-960.webp 960w, /images/house-1212.webp 1212w"
          sizes="100vw"
        />
        <img
          src="/images/house-1200.jpg"
          alt={t('photoAlt')}
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_30%]"
          fetchPriority="high"
        />
      </picture>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[rgba(8,15,30,0.62)]" />

      <SiteHeader overlay />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end gap-5 px-4 pb-16 pt-10 sm:px-6">
        <p className="font-semibold text-gray-300">{t('eyebrow')}</p>
        <h1 className="max-w-3xl text-4xl leading-none font-extrabold tracking-tight sm:text-7xl">
          {t('title')}
        </h1>
        <p className="max-w-xl text-lg text-gray-200 sm:text-xl">{t('lead')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/account"
            className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('account')}
          </Link>
        </div>
      </main>
    </section>
  );
}
