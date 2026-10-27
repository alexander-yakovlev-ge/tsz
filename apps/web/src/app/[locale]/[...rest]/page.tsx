import { notFound } from 'next/navigation';

// Любой неизвестный адрес внутри языка — локализованная 404 из [locale]/not-found.tsx.
export default function CatchAll() {
  notFound();
}
