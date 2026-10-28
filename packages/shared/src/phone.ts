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

/** Телефон для показа: `+995555123456` → `+995 555 12 34 56`. Не E.164 — строка как есть. */
export function formatPhone(phone: string): string {
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
}

/** Ссылка на чат WhatsApp (ТЗ п. 6.5): `https://wa.me/<номер без +>`. null — телефон не в E.164. */
export function whatsappChatUrl(phone: string): string | null {
  return /^\+[1-9]\d{7,14}$/.test(phone) ? `https://wa.me/${phone.slice(1)}` : null;
}
