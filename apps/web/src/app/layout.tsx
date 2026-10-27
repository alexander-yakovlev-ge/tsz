import type { ReactNode } from 'react';

// Разметка документа (<html lang>) — в app/[locale]/layout.tsx: язык известен только там.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
