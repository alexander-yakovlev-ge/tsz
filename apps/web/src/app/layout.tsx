import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ТСЖ — Тамар Мепе, 1',
  description: 'Сайт товарищества собственников жилья, г. Батуми, пр. Тамар Мепе, 1',
};

// Язык и локализованная вёрстка появятся на этапе 2 (next-intl).
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ka">
      <body>{children}</body>
    </html>
  );
}
