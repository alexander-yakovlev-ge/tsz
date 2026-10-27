import { aggregateHealth } from './health';

describe('aggregateHealth', () => {
  it('is ok when every check is ok', () => {
    expect(aggregateHealth({ db: 'ok', storage: 'ok' }).status).toBe('ok');
  });

  it('is error when any check fails', () => {
    const report = aggregateHealth({ db: 'ok', storage: 'error' });
    expect(report.status).toBe('error');
    expect(report.checks.storage).toBe('error');
  });
});
