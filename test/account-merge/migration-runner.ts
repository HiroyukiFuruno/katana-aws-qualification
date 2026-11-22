import { readdirSync } from 'node:fs';
import { dataMigrations } from '../../scripts/data-migrations';
import { run } from './commands';
import { compose } from './settings';

export function declaredMigrations() {
  const names = readdirSync('supabase/migrations').filter((name) => /^\d{12}_[a-z_]+\.sql$/.test(name));
  if (
    names.length !== dataMigrations.length ||
    names.some((name) => !dataMigrations.some((declared) => declared === name))
  )
    throw new Error('Migration inventory differs from the declared application order');
  return [...dataMigrations];
}

export function applyMigration(migration: string) {
  if (!dataMigrations.some((name) => name === migration)) throw new Error('Undeclared migration');
  run('docker', [
    ...compose,
    'exec',
    '-T',
    'database',
    'psql',
    '--set=VERBOSITY=verbose',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'supabase_auth_admin',
    '-d',
    'kaq_account_merge',
    '-f',
    `/migrations/${migration}`,
  ]);
}
