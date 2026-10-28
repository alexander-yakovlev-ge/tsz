'use client';

import type { Messages } from 'next-intl';
import { useTranslations } from 'next-intl';
import type { ApiResult } from './client-api';

type ErrorKey = keyof Messages['errors'];

/** Переводит коды ошибок API в текст: общий текст формы и ошибки отдельных полей. */
export function useApiErrors() {
  const t = useTranslations('errors');

  function text(code: string | undefined): string {
    return t.has(code as ErrorKey) ? t(code as ErrorKey) : t('UNKNOWN');
  }

  return {
    /** Общий текст ошибки для неуспешного ответа */
    message(result: Extract<ApiResult<unknown>, { ok: false }>): string {
      if (result.status === 0) {
        return t('NETWORK');
      }
      return text(result.error?.code);
    },
    /** Ошибки полей при VALIDATION: имя поля → текст */
    fields(result: Extract<ApiResult<unknown>, { ok: false }>): Record<string, string> {
      return Object.fromEntries(
        Object.entries(result.error?.fields ?? {}).map(([field, code]) => [field, text(code)]),
      );
    },
  };
}
