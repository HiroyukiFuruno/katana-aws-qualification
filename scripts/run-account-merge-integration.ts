import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { run } from '../test/account-merge/commands';
import { verifyLockingHarness } from '../test/account-merge/locking-harness';
import { prepareFixtures } from '../test/account-merge/prepare';
import { publicState } from '../test/account-merge/public-state';
import { verifyPublicSchemaGuards } from '../test/account-merge/schema-guards';
import { verifyScopeComponents } from '../test/account-merge/scope-components';
import { seedPublicData } from '../test/account-merge/seed-public';
import { artifacts, compose } from '../test/account-merge/settings';
import { verifySnapshotComponent } from '../test/account-merge/snapshot-component';
import { dataMigrations } from './data-migrations';

function applyMigration(migration: string) {
  run('docker', [
    ...compose,
    'exec',
    '-T',
    'database',
    'psql',
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

async function verifyFoundationMigration(migration: string) {
  run('docker', [...compose, 'up', '-d', '--wait', 'gateway']);
  const seed = await seedPublicData();
  try {
    verifyPublicSchemaGuards();
    const before = publicState();
    const owners = before.tables.filter((table) => table.name !== 'published_fundamentals_catalogs');
    assert.equal(owners.length, 12);
    assert.ok(
      owners.every((table) => table.rows > 0),
      'Populate all existing owner tables before migration',
    );
    applyMigration(migration);
    const after = publicState();
    assert.deepEqual(after, before, 'The private foundation changed existing public schema or data');
    writeFileSync(
      `${artifacts}/foundation-boundary.json`,
      JSON.stringify(
        {
          status: 'passed',
          migration,
          observedAt: new Date().toISOString(),
          populatedOwnerTables: owners.length,
          before,
          after,
        },
        null,
        2,
      ),
    );
  } finally {
    await seed.cleanup();
    writeFileSync(
      `${artifacts}/foundation-seed-cleanup.json`,
      JSON.stringify(
        {
          status: 'passed',
          observedAt: new Date().toISOString(),
          syntheticUserId: seed.userId,
          authRemaining: 0,
          ownerRowsRemaining: 0,
          confirmation: 'Admin DELETE/GET404 and all 12 table checks',
        },
        null,
        2,
      ),
    );
  }
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
    if (migration === '202611210004_learning_account_foundation.sql')
      await verifyFoundationMigration(migration);
    else applyMigration(migration);
  }
  console.log(`Applied ${migrations.length} migrations to the dedicated account-merge database`);
}

prepareFixtures();
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
  verifyScopeComponents();
  await verifySnapshotComponent();
  // 追加部品をすべて作成した後に、private関数全体の権限漏れを照合する。
  verifyScopeComponents('acl');
} finally {
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], {
    encoding: 'utf8',
  });
  writeFileSync(`${artifacts}/services.log`, `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
  run('docker', [...compose, 'down', '--volumes']);
}
await verifyLockingHarness();
