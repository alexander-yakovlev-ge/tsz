import { parsePhoneNumberFromString } from 'libphonenumber-js';

/** Номер без кода страны считается грузинским (ТЗ п. 5.1). */
const DEFAULT_COUNTRY = 'GE';

/**
 * Приводит телефон к E.164: `555 12 34 56` → `+995555123456`.
 * Возвращает null, если номер не похож на телефон. Проверяется только длина номера, а не
 * принадлежность диапазонам операторов: метаданные библиотеки отстают от реальных выпусков номеров.
 */
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), DEFAULT_COUNTRY);
  if (!parsed || !parsed.isPossible()) {
    return null;
  }
  return parsed.number;
}
