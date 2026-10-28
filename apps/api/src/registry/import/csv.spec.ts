import { CsvError, parseCsv } from './csv';

const csv = (text: string) => parseCsv(Buffer.from(text, 'utf8'));

describe('parseCsv', () => {
  it('detects the delimiter and lowercases column names', () => {
    expect(csv('Cadastral_Code;KIND\n05.30;APARTMENT\n')).toEqual({
      columns: ['cadastral_code', 'kind'],
      rows: [{ line: 2, values: { cadastral_code: '05.30', kind: 'APARTMENT' } }],
    });
    expect(csv('a,b\n1,2').rows[0]?.values).toEqual({ a: '1', b: '2' });
  });

  it('handles BOM, quotes, doubled quotes, CRLF and line breaks inside quotes', () => {
    const table = csv('﻿name;note\r\n"შპს ""ალფა""";"two\nlines"\r\nplain;x\r\n');
    expect(table.columns).toEqual(['name', 'note']);
    expect(table.rows).toEqual([
      { line: 2, values: { name: 'შპს "ალფა"', note: 'two\nlines' } },
      { line: 4, values: { name: 'plain', note: 'x' } },
    ]);
  });

  it('skips blank lines and fills missing trailing fields', () => {
    const table = csv('a;b;c\n\n1;2\n;;\n');
    expect(table.rows).toEqual([{ line: 3, values: { a: '1', b: '2', c: '' } }]);
  });

  it('rejects broken files instead of importing garbage', () => {
    expect(() => csv('a;b\n"open;1')).toThrow(CsvError);
    expect(() => csv('a;b\n1;2;3')).toThrow(CsvError);
    expect(() => parseCsv(Buffer.from([0x61, 0x0a, 0xff, 0xfe]))).toThrow(CsvError);
  });
});
