import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { UserForm } from '../user-form';
import { LocaleParams, readLocale } from '@/i18n/params';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'users' });
  return { title: t('newTitle') };
}

export default async function NewUserPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const t = await getTranslations('users');

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Link href="/admin/users" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <PageTitle>{t('newTitle')}</PageTitle>
      <Card>
        <UserForm />
      </Card>
    </div>
  );
}
