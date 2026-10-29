function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/** Конфигурация из переменных окружения. Читается лениво, чтобы тесты могли подменять env. */
export const env = {
  get port(): number {
    return Number(optional('API_PORT', '3001'));
  },
  get workerHealthPort(): number {
    return Number(optional('WORKER_HEALTH_PORT', '3002'));
  },
  /** Секрет подписи JWT сессии, общий с web (ТЗ п. 11). */
  get jwtSecret(): string {
    const secret = required('JWT_SECRET');
    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters');
    }
    return secret;
  },
  /**
   * Ключ шифрования номеров документов собственников (ТЗ п. 4.3, 11). Из него выводятся
   * ключи AES-GCM и HMAC. Смена ключа без перешифрования делает номера нечитаемыми.
   */
  get idNumbersKey(): string {
    const key = required('ID_NUMBERS_KEY');
    if (key.length < 32) {
      throw new Error('ID_NUMBERS_KEY must be at least 32 characters');
    }
    return key;
  },
  /** Тестовый API для e2e (/api/test/*). В продакшене выключен. */
  get enableTestApi(): boolean {
    return optional('ENABLE_TEST_API', 'false') === 'true';
  },
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
  get s3(): {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
  } {
    return {
      endpoint: required('S3_ENDPOINT'),
      region: optional('S3_REGION', 'us-east-1'),
      accessKey: required('S3_ACCESS_KEY'),
      secretKey: required('S3_SECRET_KEY'),
      bucket: optional('S3_BUCKET', 'files'),
    };
  },
};
