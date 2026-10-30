/**
 * Генератор синтетических тестовых данных (docs/plan.md, разд. 1.3).
 * Реальная выписка и персональные данные в репозиторий не попадают —
 * генератор воспроизводит только её структуру. Наборы данных добавляются по этапам:
 * этап 4 — registry.csv (помещения и собственники одним файлом), этап 7 — «новая выписка».
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateOwners, generateUnits, Manifest, RegistryRow, toCsv, UnitKind } from './registry';

const outDir = process.env.FIXTURES_DIR ?? path.resolve(process.cwd(), 'out');

function main(): void {
  mkdirSync(outDir, { recursive: true });
  const units = generateUnits();
  const owners = generateOwners(units);

  const byKind: Record<UnitKind, number> = {
    APARTMENT: 0,
    PARKING: 0,
    COMMERCIAL: 0,
    TECHNICAL: 0,
  };
  units.forEach((unit) => byKind[unit.kind]++);
  const manifest: Manifest = { units: { total: units.length, byKind }, owners: owners.manifest };

  // Строка — помещение и один его собственник; у совладельцев данные помещения повторяются.
  const unitByCode = new Map(units.map((unit) => [unit.cadastral_code, unit]));
  const rows: RegistryRow[] = owners.rows.map((owner) => ({
    ...unitByCode.get(owner.cadastral_code)!,
    ...owner,
  }));
  writeFileSync(
    path.join(outDir, 'registry.csv'),
    toCsv(rows, [
      'cadastral_code',
      'kind',
      'number',
      'floor',
      'floor_label',
      'area_m2',
      'owner_key',
      'owner_kind',
      'registry_name',
      'id_numbers',
      'share',
      'share_note',
      'is_contact',
      'phone',
    ]),
  );
  writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `fixtures: ${units.length} units (${JSON.stringify(byKind)}), ${owners.rows.length} ownership rows, ` +
      `${owners.manifest.keys} owner keys → ${outDir}/registry.csv`,
  );
}

main();
