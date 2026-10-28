import type { UserListItem } from '@tsz/shared';
import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { buttonClass, PageTitle } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { apiGet, getSession } from '@/lib/api';
import { LocaleParams, readLocale } from '@/i18n/params';

interface Props {
  params: LocaleParams;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = await getTranslations({ locale, namespace: 'users' });
  return { title: t('title') };
}

/** Раздел «Пользователи» (ТЗ п. 8.2). Привязка к собственникам появится на этапе 4. */
export default async function UsersPage({ params }: Props) {
  const locale = await readLocale(params);
  setRequestLocale(locale);
  const [t, format, me, result] = await Promise.all([
    getTranslations('users'),
    getFormatter(),
    getSession(),
    apiGet<{ users: UserListItem[] }>('/api/users'),
  ]);
  const users = result?.users ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle>{t('title')}</PageTitle>
        <Link href="/admin/users/new" className={buttonClass.primary}>
          {t('add')}
        </Link>
      </div>

      {users.length === 0 ? (
        <p className="text-gray-600">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-gray-200 text-sm text-gray-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('phone')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('name')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('role')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('language')}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t('createdAt')}
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-bold whitespace-nowrap text-accent underline-offset-4 hover:underline"
                    >
                      {user.phone}
                    </Link>
                    {user.id === me?.id && (
                      <span className="ml-2 text-sm text-gray-600">({t('you')})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{user.name ?? '—'}</td>
                  <td className="px-4 py-3">{t(`roles.${user.role}`)}</td>
                  <td className="px-4 py-3">{t(`languages.${user.language}`)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format.dateTime(new Date(user.createdAt), { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
