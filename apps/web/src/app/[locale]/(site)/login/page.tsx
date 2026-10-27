import { safeCallbackUrl } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { LoginForm } from './login-form';
import { LocaleParams, readLocale } from '@/i18n/params';

interface Props {
  params: LocaleParams;
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'login' });
  return { title: t('title'), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('login');
  const { callbackUrl } = await searchParams;
  // Возврат на исходную страницу — только по относительному адресу (ТЗ п. 11).
  const safe = safeCallbackUrl(typeof callbackUrl === 'string' ? callbackUrl : null, '');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <PageTitle>{t('title')}</PageTitle>
      <p className="text-gray-600">{t('intro')}</p>
      <Card>
        <LoginForm callbackUrl={safe || null} />
      </Card>
    </div>
  );
}
