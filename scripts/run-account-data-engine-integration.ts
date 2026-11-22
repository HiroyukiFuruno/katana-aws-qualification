import { spawnSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { run } from '../test/account-merge/commands';
import { dataEnginePublicSeed } from '../test/account-merge/data-engine';
import { captureNativeInputs } from '../test/account-merge/input-integrity';
import { ownersFromSmoke } from '../test/account-merge/owner-shadow-support';
import { prepareFixtures } from '../test/account-merge/prepare';
import { artifacts, compose } from '../test/account-merge/settings';
import { verifyFoundationBoundary } from './account-foundation-boundary';
import { dataEngineMigrationPhases } from './data-engine-migration-plan';
import { dataMigrations } from './data-migrations';

const proposal = 'supabase/account-merge/data-engine-proposal.sql';
const database = ['-U', 'supabase_auth_admin', '-d', 'kaq_account_merge'];

function psql(sql: string) {
  run('docker', [
    ...compose,
    'exec',
    '-T',
    'database',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    ...database,
    '-c',
    sql,
  ]);
}

function apply(path: string) {
  run('docker', [
    ...compose,
    'exec',
    '-T',
    'database',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    ...database,
    '-f',
    path.startsWith('supabase/') ? `/migrations/${path.split('/').at(-1)}` : `/${path}`,
  ]);
}

// Account-merge candidates are deliberately unregistered and therefore are not mounted at
// `/migrations`. Feed the reviewed repository file to psql directly rather than relying on
// an accidental container path.
function applySql(label: string, input: string) {
  const result = spawnSync(
    'docker',
    [...compose, 'exec', '-T', 'database', 'psql', '-v', 'ON_ERROR_STOP=1', ...database, '-f', '-'],
    { encoding: 'utf8', input, maxBuffer: 10 * 1024 * 1024 },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  appendFileSync(`${artifacts}/integration.log`, output);
  process.stdout.write(output);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Unable to install ${label}: ${result.status}`);
}

function applySource(path: string) {
  applySql(path, readFileSync(path, 'utf8'));
}

async function applyRegisteredMigrations(migrations: readonly string[]) {
  const available = readdirSync('supabase/migrations').filter((name) =>
    /^\d{12}_[a-z_]+\.sql$/.test(name),
  );
  if (
    available.length !== dataMigrations.length ||
    dataMigrations.some((name) => !available.includes(name))
  )
    throw new Error('Data migration inventory differs from the canonical registry');
  for (const migration of migrations) {
    if (migration === '202611210004_learning_account_foundation.sql') {
      run('docker', [...compose, 'up', '-d', '--wait', 'gateway']);
      await verifyFoundationBoundary((name) => apply(`supabase/migrations/${name}`), migration);
    } else apply(`supabase/migrations/${migration}`);
  }
}

function applyProposal() {
  const sql = readFileSync(proposal, 'utf8');
  if (!sql.includes('KAQ_MERGE_EXAM_KEY_CHANGED'))
    throw new Error('Missing owner-scoped exam proposal guard');
  applySource(proposal);
  for (const path of [
    'supabase/account-merge/learning-snapshot.sql',
    'supabase/account-merge/data-engine-snapshot.sql',
    'supabase/account-merge/data-engine.sql',
    'supabase/account-merge/data-engine-lineage.sql',
  ])
    applySource(path);
}

function saveServicesLog() {
  const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], { encoding: 'utf8' });
  writeFileSync(`${artifacts}/data-engine-services.log`, `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
}

prepareFixtures();
const verifyInputsUnchanged = captureNativeInputs({ sdkGrep: null });
const { beforeShadow, ownerShadow } = dataEngineMigrationPhases();
try {
  run('docker', [...compose, 'up', '-d', '--wait', 'database', 'auth', 'kaq-merge-idp']);
  await applyRegisteredMigrations(beforeShadow);
  run('docker', [...compose, 'up', '-d', '--wait', 'gateway']);
  psql("select current_setting('transaction_isolation') = 'read committed'");
  run('bunx', ['playwright', 'test', '--config=playwright.account-merge.config.ts']);
  for (const owner of ownersFromSmoke())
    applySql(`old-schema seed for ${owner.userId}`, dataEnginePublicSeed(owner.userId));
  await applyRegisteredMigrations(ownerShadow);
  applyProposal();
  run('bunx', ['playwright', 'test', '--config=playwright.account-data-engine.config.ts']);
  writeFileSync(
    `${artifacts}/data-engine-manifest.json`,
    `${JSON.stringify(
      {
        status: 'passed',
        observedAt: new Date().toISOString(),
        runner: 'real-oidc-gotrue-postgrest-postgres',
        installed: [
          ...dataMigrations,
          'supabase/account-merge/learning-snapshot.sql',
          'supabase/account-merge/data-engine-proposal.sql',
          'supabase/account-merge/data-engine-snapshot.sql',
          'supabase/account-merge/data-engine.sql',
          'supabase/account-merge/data-engine-lineage.sql',
        ],
        cleanup: 'docker compose down --volumes',
      },
      null,
      2,
    )}\n`,
  );
} finally {
  saveServicesLog();
  run('docker', [...compose, 'down', '--volumes']);
  verifyInputsUnchanged();
}
