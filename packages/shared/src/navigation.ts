/**
 * Адрес возврата после входа (ТЗ п. 11): принимается только относительный путь сайта.
 * `//evil.com` и `/\evil.com` браузер трактует как другой домен — они отклоняются.
 */
export function safeCallbackUrl(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }
  return value;
}
