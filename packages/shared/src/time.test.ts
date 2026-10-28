import { fromTbilisiLocal, toTbilisiLocal } from './time';

describe('Tbilisi time', () => {
  it('reads form input as Tbilisi time (UTC+4)', () => {
    expect(fromTbilisiLocal('2026-11-01T09:30')).toBe('2026-11-01T05:30:00.000Z');
    expect(fromTbilisiLocal('2026-07-01T00:00:00')).toBe('2026-06-30T20:00:00.000Z');
  });

  it('rejects empty and malformed input', () => {
    expect(fromTbilisiLocal('')).toBeNull();
    expect(fromTbilisiLocal('01.11.2026 09:30')).toBeNull();
    expect(fromTbilisiLocal('2026-13-45T25:00')).toBeNull();
  });

  it('formats a moment for the form', () => {
    expect(toTbilisiLocal('2026-11-01T05:30:59.000Z')).toBe('2026-11-01T09:30');
    expect(toTbilisiLocal(new Date('2026-12-31T21:00:00Z'))).toBe('2027-01-01T01:00');
  });
});
