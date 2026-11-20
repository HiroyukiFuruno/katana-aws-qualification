import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedSql } from './fundamentals-seed-support';

const output = join(process.cwd(), 'supabase/migrations/202611200010_fundamentals_catalog.sql');
const mode = process.argv[2];
const expected = await seedSql();

if (mode === '--write') {
  await writeFile(output, expected);
} else if (mode === '--check') {
  if ((await readFile(output, 'utf8').catch(() => '')) !== expected)
    throw new Error('Generated fundamentals catalog migration is stale.');
} else {
  throw new Error('Usage: bun scripts/fundamentals-seed.ts --write|--check');
}
