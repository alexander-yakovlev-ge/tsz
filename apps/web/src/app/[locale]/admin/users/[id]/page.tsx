import type { UserListItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { apiGet, getSession } from '@/lib/api';
import { UserForm } from '../user-form';
import { DeleteUserButton } from './delete-user-button';
import { ResetPasswordForm } from './reset-password-form';
import { readLocale } from '@/i18n/params';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'users' });
  return { title: t('editTitle') };
}

export default async function EditUserPage({ params }: Props) {
  const { id } = await params;
  const locale = await readLocale(params);
  setRequestLocale(locale);
  // API валидирует id как UUID и отвечает 404 на неизвестный или удалённый (ТЗ п. 10).
  const [t, me, result] = await Promise.all([
    getTranslations('users'),
    getSession(),
    apiGet<{ user: UserListItem }>(`/api/users/${encodeURIComponent(id)}`),
  ]);
  if (!result) {
    notFound();
  }
  const { user } = result;
  const isSelf = user.id === me?.id;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Link href="/admin/users" className="font-semibold text-accent hover:underline">
        {t('back')}
      </Link>
      <PageTitle>
        {user.phone}
        {isSelf && (
          <span className="ml-3 align-middle text-base font-semibold text-gray-600">
            ({t('you')})
          </span>
        )}
      </PageTitle>
      <Card>
        <UserForm user={user} isSelf={isSelf} />
      </Card>
      <Card>
        <h2 className="mb-2 text-xl font-bold">{t('resetTitle')}</h2>
        <p className="mb-4 text-sm text-gray-600">{t('resetHint')}</p>
        <ResetPasswordForm userId={user.id} />
      </Card>
      {!isSelf && (
        <Card className="border-red-200">
          <h2 className="mb-2 text-xl font-bold">{t('deleteTitle')}</h2>
          <p className="mb-4 text-sm text-gray-600">{t('deleteHint')}</p>
          <DeleteUserButton userId={user.id} phone={user.phone} />
        </Card>
      )}
    </div>
  );
}
