import type { DocumentType } from '@tsz/shared';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END_OF_DIRECTORY = 0x06054b50;

/**
 * Тип файла по содержимому, а не по имени (ТЗ п. 8.6). DOCX и XLSX — ZIP-архивы Office Open XML:
 * их различает состав архива. null — формат не из разрешённых.
 */
export function detectDocumentType(file: Buffer): DocumentType | null {
  if (file.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'pdf';
  }
  if (file.subarray(0, PNG.length).equals(PNG)) {
    return 'png';
  }
  if (file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff) {
    return 'jpg';
  }
  if (file.length >= 4 && file.readUInt32LE(0) === ZIP_LOCAL_HEADER) {
    const names = zipEntryNames(file);
    if (names?.has('[Content_Types].xml')) {
      if (names.has('word/document.xml')) {
        return 'docx';
      }
      if (names.has('xl/workbook.xml')) {
        return 'xlsx';
      }
    }
  }
  return null;
}

/** Имена файлов из центрального каталога ZIP. null — архив повреждён. */
function zipEntryNames(file: Buffer): Set<string> | null {
  // Запись конца каталога — в последних 22 байтах плюс комментарий архива (до 64 КБ).
  const searchFrom = Math.max(0, file.length - 22 - 0xffff);
  let end = -1;
  for (let offset = file.length - 22; offset >= searchFrom; offset--) {
    if (file.readUInt32LE(offset) === ZIP_END_OF_DIRECTORY) {
      end = offset;
      break;
    }
  }
  if (end < 0) {
    return null;
  }
  const count = file.readUInt16LE(end + 10);
  let offset = file.readUInt32LE(end + 16);
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (offset + 46 > file.length || file.readUInt32LE(offset) !== ZIP_CENTRAL_HEADER) {
      return null;
    }
    const nameLength = file.readUInt16LE(offset + 28);
    const extraLength = file.readUInt16LE(offset + 30);
    const commentLength = file.readUInt16LE(offset + 32);
    if (offset + 46 + nameLength > file.length) {
      return null;
    }
    names.add(file.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
