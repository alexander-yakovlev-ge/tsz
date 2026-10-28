/**
 * Все даты показываются и вводятся по времени Тбилиси (ТЗ п. 4). В Грузии нет перехода
 * на летнее время, поэтому смещение постоянное.
 */
export const TBILISI_OFFSET = '+04:00';
const OFFSET_MS = 4 * 60 * 60 * 1000;

/** Значение `<input type="datetime-local">` по Тбилиси → ISO-строка. null — пустое или неверное. */
export function fromTbilisiLocal(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return null;
  }
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}${TBILISI_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Момент времени → значение `<input type="datetime-local">` по Тбилиси, с точностью до минуты. */
export function toTbilisiLocal(date: Date | string): string {
  return new Date(new Date(date).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}
