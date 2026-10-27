import { safeCallbackUrl } from './navigation';

describe('safeCallbackUrl', () => {
  it('keeps relative paths with query strings', () => {
    expect(safeCallbackUrl('/ru/admin/users?page=2', '/ru')).toBe('/ru/admin/users?page=2');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeCallbackUrl('https://evil.com', '/ru')).toBe('/ru');
    expect(safeCallbackUrl('//evil.com', '/ru')).toBe('/ru');
    expect(safeCallbackUrl('/\\evil.com', '/ru')).toBe('/ru');
    expect(safeCallbackUrl('javascript:alert(1)', '/ru')).toBe('/ru');
  });

  it('rejects empty values and control characters', () => {
    expect(safeCallbackUrl(null, '/ka')).toBe('/ka');
    expect(safeCallbackUrl('', '/ka')).toBe('/ka');
    expect(safeCallbackUrl('/ka\n/admin', '/ka')).toBe('/ka');
  });
});
