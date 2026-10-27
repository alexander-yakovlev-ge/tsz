import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Монорепозиторий: трассировка зависимостей от корня, чтобы standalone-сборка включила пакеты workspace.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@tsz/shared'],
  poweredByHeader: false,
  // Линтер запускается отдельно (`make check`), в сборке не дублируем.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
