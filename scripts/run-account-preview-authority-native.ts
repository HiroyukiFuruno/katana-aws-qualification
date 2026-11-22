import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { run, sql } from '../test/account-merge/commands';
import { captureNativeInputs } from '../test/account-merge/input-integrity';
import { applyMigration, declaredMigrations } from '../test/account-merge/migration-runner';
import { prepareFixtures } from '../test/account-merge/prepare';
import { installPreviewFixture, installProofComponents } from '../test/account-merge/proof-components';
import { artifacts, compose } from '../test/account-merge/settings';
import { installSdkMetadata } from '../test/account-sdk/install';

prepareFixtures();
const verifyInputsUnchanged = captureNativeInputs({ sdkGrep: 'preview authority' });
try {
  const docker = (...args: string[]) => run('docker', [...compose, ...args]);
  docker('up', '-d', '--wait', 'database', 'auth', 'kaq-merge-idp');
  const migrationList = declaredMigrations();
  const splitAt = migrationList.indexOf('202611220001_learning_owner_shadow.sql');
  if (splitAt !== 14 || migrationList.length !== 18)
    throw new Error('Unexpected owner migration boundary');
  for (const migration of migrationList.slice(0, 14)) applyMigration(migration);
  docker('up', '-d', '--wait', 'gateway');
  run('bunx', ['playwright', 'test', '--config=playwright.account-merge.config.ts']);
  for (const migration of migrationList.slice(14)) applyMigration(migration);
  installSdkMetadata();
  installProofComponents();
  sql(readFileSync('supabase/account-merge/learning-snapshot.sql', 'utf8'));
  sql(readFileSync('supabase/account-merge/data-engine-proposal.sql', 'utf8'));
  sql(readFileSync('supabase/account-merge/data-engine-snapshot.sql', 'utf8'));
  installPreviewFixture();
  run('bunx', [
    'playwright',
    'test',
    '--config=playwright.account-sdk.config.ts',
    '--grep',
    'preview authority',
  ]);
  verifyInputsUnchanged();
} finally {
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], { encoding: 'utf8' });
  writeFileSync(`${artifacts}/services.log`, `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
  run('docker', [...compose, 'down', '--volumes']);
}
