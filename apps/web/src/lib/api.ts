import type { HealthReport } from '@tsz/shared';

/** Адрес API для серверных запросов Next.js внутри docker-сети (ТЗ п. 2.2). */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://api:3001';

export async function fetchApiHealth(): Promise<HealthReport | null> {
  try {
    const response = await fetch(`${API_INTERNAL_URL}/api/health`, { cache: 'no-store' });
    return (await response.json()) as HealthReport;
  } catch {
    return null;
  }
}
