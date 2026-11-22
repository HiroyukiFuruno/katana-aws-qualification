import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { run } from '../test/account-merge/commands';
import { captureNativeInputs } from '../test/account-merge/input-integrity';
import { verifyOwnerShadowMigration } from '../test/account-merge/owner-shadow';
import { verifyOwnerShadowProductionOps } from '../test/account-merge/owner-shadow-production-ops';
import { prepareFixtures } from '../test/account-merge/prepare';
import { artifacts, compose } from '../test/account-merge/settings';
import { verifyFoundationBoundary } from './account-foundation-boundary';
import { dataMigrations } from './data-migrations';

const ownerShadowMigration = '202611220001_learning_owner_shadow.sql';
function applyMigration(migration: string) {
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
async function applyMigrations() {
  const names = readdirSync('supabase/migrations').filter((name) => /^\d{12}_[a-z_]+\.sql$/.test(name));
  for (const name of dataMigrations) {
    if (!names.includes(name)) throw new Error(`Declared data migration is missing: ${name}`);
  }
  if (
    names.length !== dataMigrations.length ||
    names.some((name) => !dataMigrations.some((declared) => declared === name))
  )
    throw new Error('Migration inventory differs from the declared application order');
  const migrations = [...dataMigrations];
  for (const migration of migrations) {
    if (migration === '202611210004_learning_account_foundation.sql') {
      run('docker', [...compose, 'up', '-d', '--wait', 'gateway']);
      await verifyFoundationBoundary(applyMigration, migration);
    } else if (migration === ownerShadowMigration) continue;
    else applyMigration(migration);
  }
  console.log(`Verified ${migrations.length} registered migrations in the foundation database`);
}
prepareFixtures();
const verifyInputsUnchanged = captureNativeInputs();
try {
  run('docker', [...compose, 'up', '-d', '--wait', 'database', 'auth', 'kaq-merge-idp']);
  await applyMigrations();
  run('docker', [...compose, 'up', '-d', '--wait', 'gateway']);
  run('bunx', [
    'playwright',
    'test',
    '--config=playwright.account-merge.config.ts',
    ...process.argv.slice(2),
  ]);
  if (process.env.KAQ_ACCOUNT_POSTGRES_IMAGE?.startsWith('postgres:17'))
    await verifyOwnerShadowProductionOps();
  await verifyOwnerShadowMigration(() => applyMigration(ownerShadowMigration));
} finally {
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], {
    encoding: 'utf8',
  });
  writeFileSync(`${artifacts}/services.log`, `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
  run('docker', [...compose, 'down', '--volumes']);
}
verifyInputsUnchanged();
