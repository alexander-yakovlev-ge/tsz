export interface CsvRow {
  /** Номер строки файла, на которой начинается запись; заголовок — строка 1 */
  line: number;
  values: Record<string, string>;
}

export interface CsvTable {
  columns: string[];
  rows: CsvRow[];
}

export class CsvError extends Error {}

/** Разделитель — `;` или `,` (ТЗ п. 8.10): какого больше в заголовке вне кавычек. */
function detectDelimiter(text: string): ';' | ',' {
  const header = text.slice(0, text.search(/\r?\n|$/));
  const outsideQuotes = header.replace(/"[^"]*"/g, '');
  const semicolons = outsideQuotes.split(';').length;
  const commas = outsideQuotes.split(',').length;
  return semicolons >= commas ? ';' : ',';
}

/** Записи CSV по RFC 4180: поля в кавычках, удвоенные кавычки, переводы строк внутри кавычек. */
function parseRecords(text: string, delimiter: string): { line: number; fields: string[] }[] {
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        if (char === '\n') {
          line++;
        }
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      fields.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }
      fields.push(field);
      records.push({ line: recordLine, fields });
      fields = [];
      field = '';
      line++;
      recordLine = line;
    } else {
      field += char;
    }
  }
  if (quoted) {
    throw new CsvError('Unterminated quoted field');
  }
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    records.push({ line: recordLine, fields });
  }
  return records;
}

/**
 * CSV из выписки (ТЗ п. 8.10): UTF-8, возможно с BOM. Имена столбцов — в нижнем регистре;
 * пустые строки пропускаются. Невалидный UTF-8 — ошибка, а не «кракозябры» в БД.
 */
export function parseCsv(buffer: Buffer): CsvTable {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new CsvError('Invalid UTF-8');
  }
  text = text.replace(/^\uFEFF/, '');
  const records = parseRecords(text, detectDelimiter(text)).filter((record) =>
    record.fields.some((value) => value.trim() !== ''),
  );
  const [header, ...body] = records;
  if (!header) {
    return { columns: [], rows: [] };
  }
  const columns = header.fields.map((name) => name.trim().toLowerCase());
  const rows = body.map((record) => {
    if (record.fields.length > columns.length) {
      throw new CsvError(`Too many fields on line ${record.line}`);
    }
    const values: Record<string, string> = {};
    columns.forEach((column, index) => {
      values[column] = (record.fields[index] ?? '').trim();
    });
    return { line: record.line, values };
  });
  return { columns, rows };
}
