import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { ChangePasswordForm } from './change-password-form';
import { LocaleParams, readLocale } from '@/i18n/params';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'changePassword' });
  return { title: t('title') };
}

export default async function ChangePasswordPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('changePassword');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <Link href="/account" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <PageTitle>{t('title')}</PageTitle>
      <Card>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
