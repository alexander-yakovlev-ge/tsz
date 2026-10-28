const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Параметр :id валидируется как UUID (ТЗ п. 10): иначе 404 без запроса к БД. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
