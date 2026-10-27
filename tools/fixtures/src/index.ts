/**
 * Генератор синтетических тестовых данных (docs/plan.md, разд. 1.3).
 * Реальная выписка и персональные данные в репозиторий не попадают —
 * генератор воспроизводит только её структуру. Наборы данных добавляются по этапам:
 * этап 4 — units.csv / owners.csv, этап 7 — contacts.csv и «новая выписка».
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outDir = process.env.FIXTURES_DIR ?? path.resolve(process.cwd(), 'out');

function main(): void {
  mkdirSync(outDir, { recursive: true });
  console.log(`fixtures: nothing to generate for stage 1 (output dir: ${outDir})`);
}

main();
