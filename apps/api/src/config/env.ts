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
