import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataMigrations } from './data-migrations';
import { seedSql } from './fundamentals-seed-support';

const [mode, filename] = process.argv.slice(2);
const migrations = join(process.cwd(), 'supabase/migrations');
const catalogName = /^\d{12}_fundamentals_catalog(?:_[a-z0-9_]+)?\.sql$/;
const previous = new Map<string, string>();
for (const name of dataMigrations.filter((name) => catalogName.test(name))) {
  const sql = await readFile(join(migrations, name), 'utf8');
  const rows = [
    ...sql.matchAll(
      /^ {2}\('(fundamentals\.[a-z0-9-]+)', '([a-f0-9]{64})', decode\('([a-f0-9]{64})', 'hex'\),$/gm,
    ),
  ];
  if (!rows.length) throw new Error(`Generated fundamentals catalog has no rows: ${name}`);
  for (const [, unitId, version, hash] of rows) {
    if (!unitId || !version || !hash) throw new Error(`Invalid fundamentals catalog row: ${name}`);
    const key = `${unitId}\u0000${version}`;
    if (previous.has(key)) throw new Error(`Duplicate recorded fundamentals version: ${unitId}`);
    previous.set(key, hash);
  }
}
const expected = await seedSql('public/fundamentals/delivery', previous);

if (mode === '--write' && filename && catalogName.test(filename)) {
  if (!expected) throw new Error('The current grading catalog is already recorded.');
  await writeFile(join(migrations, filename), expected, { flag: 'wx' });
} else if (mode === '--check' && !filename) {
  if (expected) throw new Error('Current fundamentals grading data is missing a migration.');
} else {
  throw new Error('Usage: bun scripts/fundamentals-seed.ts --check | --write <catalog-migration.sql>');
}
