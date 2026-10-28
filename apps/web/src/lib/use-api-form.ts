'use client';

import { useState } from 'react';
import type { ApiResult } from './client-api';
import { useApiErrors } from './use-api-errors';

export type FormStatus = { kind: 'error' | 'success'; text: string } | null;

/** Состояние формы, которая отправляет запрос к API: ожидание, общий текст и ошибки полей. */
export function useApiForm() {
  const errors = useApiErrors();
  const [status, setStatus] = useState<FormStatus>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  /** Выполняет запрос; при ошибке показывает её и возвращает null. */
  async function submit<T>(request: () => Promise<ApiResult<T>>): Promise<{ data: T } | null> {
    setPending(true);
    setStatus(null);
    const result = await request();
    setPending(false);
    if (!result.ok) {
      setStatus({ kind: 'error', text: errors.message(result) });
      setFields(errors.fields(result));
      return null;
    }
    setFields({});
    return { data: result.data };
  }

  return { status, setStatus, fields, setFields, pending, submit };
}
