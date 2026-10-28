import { AnnouncementPage, ContactInfo, HomePageContent, localized } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AnnouncementCard } from '@/components/announcement-card';
import { ContactsBlock } from '@/components/contacts-block';
import { Markdown } from '@/components/markdown';
import { SiteHeader } from '@/components/site-header';
import { Card } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { LocaleParams, readLocale } from '@/i18n/params';
import { apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/site';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata(locale, '', undefined, t('description'));
}

/**
 * Главная (ТЗ п. 6.2): название, адрес и приветствие из HomePage, 3 последних объявления
 * (ТЗ v1.9) и блок контактов (ТЗ п. 6.5).
 */
export default async function HomePage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, homeResult, contactsResult, latest] = await Promise.all([
    getTranslations('home'),
    apiGet<{ home: HomePageContent }>('/api/home'),
    apiGet<{ contacts: ContactInfo }>('/api/contacts'),
    apiGet<AnnouncementPage>('/api/announcements?limit=3'),
  ]);
  const home = homeResult?.home;
  const announcements = latest?.items ?? [];

  return (
    <>
      <section className="relative isolate flex min-h-[520px] flex-col bg-[#0b1220] text-white sm:min-h-[70vh]">
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

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end gap-5 px-4 pt-10 pb-16 sm:px-6">
          <p className="font-semibold text-gray-300">{t('eyebrow')}</p>
          <h1 className="max-w-3xl text-4xl leading-none font-extrabold tracking-tight sm:text-7xl">
            {home ? localized(home, 'name', locale) : t('fallbackTitle')}
          </h1>
          {home && (
            <p className="max-w-xl text-lg text-gray-200 sm:text-xl">
              {localized(home, 'address', locale)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href="/announcements"
              className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-bold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t('announcements')}
            </Link>
            <Link
              href="/account"
              className="inline-flex min-h-12 items-center rounded-full border border-white/60 px-6 font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t('account')}
            </Link>
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-10">
          {home && (
            <section aria-labelledby="intro-title" className="flex flex-col gap-4">
              <h2 id="intro-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t('welcome')}
              </h2>
              <Markdown className="text-lg">{localized(home, 'intro', locale)}</Markdown>
            </section>
          )}

          <section aria-labelledby="latest-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="latest-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t('latest')}
              </h2>
              <Link
                href="/announcements"
                className="font-bold text-accent underline-offset-4 hover:underline"
              >
                {t('allAnnouncements')}
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="text-gray-600">{t('noAnnouncements')}</p>
            ) : (
              announcements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  locale={locale}
                  headingLevel={3}
                />
              ))
            )}
          </section>
        </div>

        {contactsResult && (
          <aside aria-labelledby="contacts-title" className="lg:pt-1">
            <Card>
              <h2 id="contacts-title" className="mb-4 text-xl font-extrabold">
                {t('contacts')}
              </h2>
              <ContactsBlock contacts={contactsResult.contacts} locale={locale} compact />
            </Card>
          </aside>
        )}
      </main>
    </>
  );
}
