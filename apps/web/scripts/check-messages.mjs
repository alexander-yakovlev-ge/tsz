// Проверяет, что во всех языках одинаковый набор ключей (ТЗ п. 3.2: все строки переведены на три языка).
import { readFileSync } from 'node:fs';

const LOCALES = ['ka', 'ru', 'en'];

function keys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? keys(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

const sets = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    new Set(
      keys(
        JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')),
      ),
    ),
  ]),
);

let failed = false;
for (const locale of LOCALES) {
  for (const other of LOCALES) {
    const missing = [...sets[other]].filter((key) => !sets[locale].has(key));
    if (missing.length > 0) {
      failed = true;
      console.error(`messages/${locale}.json is missing: ${missing.join(', ')}`);
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log(`messages: ${sets.ru.size} keys in ${LOCALES.join(', ')}`);
