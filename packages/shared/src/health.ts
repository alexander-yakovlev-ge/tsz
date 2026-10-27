export type HealthState = 'ok' | 'error';

export interface HealthReport {
  status: HealthState;
  checks: Record<string, HealthState>;
}

export function aggregateHealth(checks: Record<string, HealthState>): HealthReport {
  const status = Object.values(checks).every((state) => state === 'ok') ? 'ok' : 'error';
  return { status, checks };
}
