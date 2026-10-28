import { detectDocumentType } from './file-type';

/** Минимальный ZIP без сжатия с пустыми файлами — достаточно для проверки состава архива. */
function zip(names: string[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe('detectDocumentType', () => {
  it('recognizes PDF, PNG and JPEG by signature', () => {
    expect(detectDocumentType(Buffer.from('%PDF-1.7\n...'))).toBe('pdf');
    expect(
      detectDocumentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])),
    ).toBe('png');
    expect(detectDocumentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toBe('jpg');
  });

  it('tells DOCX from XLSX by the archive contents', () => {
    expect(
      detectDocumentType(zip(['[Content_Types].xml', '_rels/.rels', 'word/document.xml'])),
    ).toBe('docx');
    expect(detectDocumentType(zip(['[Content_Types].xml', 'xl/workbook.xml']))).toBe('xlsx');
  });

  it('rejects other ZIP archives', () => {
    expect(detectDocumentType(zip(['readme.txt', 'word/document.xml']))).toBeNull();
    expect(detectDocumentType(zip(['[Content_Types].xml', 'ppt/presentation.xml']))).toBeNull();
  });

  it('rejects an executable renamed to .pdf and truncated archives', () => {
    expect(detectDocumentType(Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1'))).toBeNull();
    expect(
      detectDocumentType(zip(['[Content_Types].xml', 'word/document.xml']).subarray(0, 40)),
    ).toBeNull();
    expect(detectDocumentType(Buffer.alloc(0))).toBeNull();
  });
});
