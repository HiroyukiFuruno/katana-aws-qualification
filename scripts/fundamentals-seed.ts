import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedSql } from './fundamentals-seed-support';

const history = 'public/fundamentals/delivery/history/2026-11-20';
const published = join(process.cwd(), 'supabase/migrations/202611200010_fundamentals_catalog.sql');
const output = join(process.cwd(), 'supabase/migrations/202611210001_fundamentals_catalog_revision.sql');
const mode = process.argv[2];
if ((await readFile(published, 'utf8')) !== (await seedSql(history)))
  throw new Error('Published fundamentals migration or its archived input changed.');
const expected = await seedSql('public/fundamentals/delivery', [history]);

if (mode === '--write') {
  await writeFile(output, expected);
} else if (mode === '--check') {
  if ((await readFile(output, 'utf8').catch(() => '')) !== expected)
    throw new Error('Generated fundamentals catalog migration is stale.');
} else {
  throw new Error('Usage: bun scripts/fundamentals-seed.ts --write|--check');
}
