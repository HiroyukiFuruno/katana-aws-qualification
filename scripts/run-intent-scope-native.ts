import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { run } from '../test/account-merge/commands';
import { captureNativeInputs } from '../test/account-merge/input-integrity';
import { applyMigration, declaredMigrations } from '../test/account-merge/migration-runner';
import { prepareFixtures } from '../test/account-merge/prepare';
import { installProofComponents } from '../test/account-merge/proof-components';
import { artifacts, compose } from '../test/account-merge/settings';
import { installSdkMetadata } from '../test/account-sdk/install';

prepareFixtures();
const verifyInputsUnchanged = captureNativeInputs({ sdkGrep: 'intent scope' });
try {
  run('docker', [...compose, 'up', '-d', '--wait', 'database', 'auth', 'kaq-merge-idp']);
  const migrations = declaredMigrations();
  const ownerShadow = migrations.indexOf('202611220001_learning_owner_shadow.sql');
  if (ownerShadow !== 14 || migrations.length !== 18)
    throw new Error('Unexpected owner migration boundary');
  for (const migration of migrations.slice(0, ownerShadow)) applyMigration(migration);
  run('docker', [...compose, 'up', '-d', '--wait', 'gateway']);
  run('bunx', ['playwright', 'test', '--config=playwright.account-merge.config.ts']);
  for (const migration of migrations.slice(ownerShadow)) applyMigration(migration);
  installSdkMetadata();
  installProofComponents();
  run('bunx', [
    'playwright',
    'test',
    '--config=playwright.account-sdk.config.ts',
    '--grep',
    'intent scope',
  ]);
  verifyInputsUnchanged();
} finally {
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], { encoding: 'utf8' });
  writeFileSync(`${artifacts}/services.log`, `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
  run('docker', [...compose, 'down', '--volumes']);
}
