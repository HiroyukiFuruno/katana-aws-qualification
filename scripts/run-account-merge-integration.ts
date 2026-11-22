import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import {
  installAccountCreationFixture,
  removeAccountCreationFixture,
} from '../test/account-merge/account-creation-components';
import { run } from '../test/account-merge/commands';
import { verifyDeleteJobsCore } from '../test/account-merge/delete-jobs-core';
import { captureNativeInputs } from '../test/account-merge/input-integrity';
import { verifyOwnerShadowMigration } from '../test/account-merge/owner-shadow';
import { verifyOwnerShadowProductionOps } from '../test/account-merge/owner-shadow-production-ops';
import { prepareFixtures } from '../test/account-merge/prepare';
import { installProofComponents, removeProofWrapper } from '../test/account-merge/proof-components';
import { verifyScopeComponents } from '../test/account-merge/scope-components';
import { runSdk, sdkSelection } from '../test/account-merge/sdk-selection';
import { artifacts, compose } from '../test/account-merge/settings';
import { verifySnapshotComponent } from '../test/account-merge/snapshot-component';
import { installSdkMetadata } from '../test/account-sdk/install';
import { verifyFoundationBoundary } from './account-foundation-boundary';
import { verifyAccountMergeHarnesses } from './account-merge-harnesses';
import { dataMigrations } from './data-migrations';

const ownerShadowMigration = '202611220001_learning_owner_shadow.sql';
const contextHelpersMigration = '202611220002_learning_context_helpers.sql';
const sessionGrantsMigration = '202611220003_learning_session_grants.sql';
const accountGrantsConfig = '--config=playwright.account-grants.config.ts';
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
    } else if (
      [
        ownerShadowMigration,
        contextHelpersMigration,
        sessionGrantsMigration,
        '202611220004_learning_account_creation.sql',
      ].includes(migration)
    )
      continue;
    else applyMigration(migration);
  }
  console.log(`Applied ${migrations.length} migrations to the dedicated account-merge database`);
}
const selection = sdkSelection(process.argv.slice(2));
prepareFixtures();
const verifyInputsUnchanged = captureNativeInputs(selection);
try {
  run('docker', [...compose, 'up', '-d', '--wait', 'database', 'auth', 'kaq-merge-idp']);
  await applyMigrations();
  run('docker', [...compose, 'up', '-d', '--wait', 'gateway']);
  run('bunx', [
    'playwright',
    'test',
    '--config=playwright.account-merge.config.ts',
    ...selection.scopeArgs,
  ]);
  if (process.env.KAQ_ACCOUNT_POSTGRES_IMAGE?.startsWith('postgres:17'))
    await verifyOwnerShadowProductionOps();
  await verifyOwnerShadowMigration(() => applyMigration(ownerShadowMigration));
  applyMigration(contextHelpersMigration);
  applyMigration(sessionGrantsMigration);
  applyMigration('202611220004_learning_account_creation.sql');
  writeFileSync(`${artifacts}/delete-job-core.json`, JSON.stringify(verifyDeleteJobsCore(), null, 2));
  verifyScopeComponents('session', true);
  installSdkMetadata();
  installProofComponents();
  installAccountCreationFixture();
  try {
    run('bunx', ['playwright', 'test', accountGrantsConfig]);
    run('bunx', ['playwright', 'test', '--config=playwright.account-creation.config.ts']);
    runSdk(selection.sdkArgs);
  } finally {
    removeAccountCreationFixture();
    removeProofWrapper();
  }
  await verifySnapshotComponent();
  verifyScopeComponents('acl', true);
} finally {
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], {
    encoding: 'utf8',
  });
  writeFileSync(`${artifacts}/services.log`, `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
  run('docker', [...compose, 'down', '--volumes']);
}
await verifyAccountMergeHarnesses();
verifyInputsUnchanged();
