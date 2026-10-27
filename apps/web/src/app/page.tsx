import { fetchApiHealth } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await fetchApiHealth();
  const apiStatus = health?.status ?? 'unreachable';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-4">
      <h1 className="text-3xl font-semibold">ТСЖ — Тамар Мепе, 1</h1>
      <p className="text-slate-600">
        საიტი მუშავდება · Сайт в разработке · Website under construction
      </p>
      <p className="text-sm text-slate-500">
        API: <span data-testid="api-status">{apiStatus}</span>
      </p>
    </main>
  );
}
