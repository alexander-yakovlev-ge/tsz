import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('treats numbers without country code as Georgian', () => {
    expect(normalizePhone('555 12 34 56')).toBe('+995555123456');
    expect(normalizePhone('555123456')).toBe('+995555123456');
  });

  it('keeps international numbers', () => {
    expect(normalizePhone('+995 555 12-34-56')).toBe('+995555123456');
    expect(normalizePhone('+7 912 345-67-89')).toBe('+79123456789');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects things that are not phone numbers', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('hello')).toBeNull();
  });
});
