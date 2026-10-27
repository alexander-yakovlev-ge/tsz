import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/auth';
import { LocaleParams, readLocale } from '@/i18n/params';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('title') };
}

/** Помещения и баланс появятся на этапах 4–5; пока — приветствие и ссылки. */
export default async function AccountPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, user] = await Promise.all([getTranslations('account'), requireUser(locale)]);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-lg">
        {user.name ? t('greeting', { name: user.name }) : t('greetingNoName')}
      </p>
      <p className="text-gray-600">{t('noUnits')}</p>
      <Card className="max-w-md">
        <h2 className="mb-3 text-xl font-bold">{t('security')}</h2>
        <Link
          href="/account/change-password"
          className="font-bold text-accent underline-offset-4 hover:underline"
        >
          {t('changePassword')}
        </Link>
      </Card>
    </div>
  );
}
