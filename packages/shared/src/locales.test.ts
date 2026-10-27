import { DEFAULT_LOCALE, isLocale } from './locales';

describe('isLocale', () => {
  it('accepts supported locales', () => {
    expect(isLocale('ka')).toBe(true);
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('en')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it('defaults to Georgian', () => {
    expect(DEFAULT_LOCALE).toBe('ka');
  });
});
