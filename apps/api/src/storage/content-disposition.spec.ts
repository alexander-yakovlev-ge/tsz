import { contentDisposition } from './storage.service';

describe('contentDisposition', () => {
  it('keeps the original name in UTF-8 with an ASCII fallback', () => {
    expect(contentDisposition('Устав (ред. 2).pdf')).toBe(
      `attachment; filename="_____ (___. 2).pdf"; filename*=UTF-8''%D0%A3%D1%81%D1%82%D0%B0%D0%B2%20%28%D1%80%D0%B5%D0%B4.%202%29.pdf`,
    );
  });

  it('escapes quotes in the fallback name', () => {
    expect(contentDisposition('a"b.pdf')).toMatch(/^attachment; filename="a_b.pdf";/);
  });
});
