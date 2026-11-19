import { spawnSync } from 'node:child_process';
import { createSessions, verifyPostgrest, waitForRest } from '../test/data/rest-client.ts';
import { verifyConcurrentRevisions } from '../test/data/verify-concurrency.ts';

const compose = ['compose', '-f', 'test/data/compose.yml'];

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
}

function psql(userA: string, userB: string) {
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
    'kaq_data',
    '-v',
    `user_a=${userA}`,
    '-v',
    `user_b=${userB}`,
    '-f',
    '/verification/verify.sql',
    '-f',
    '/verification/verify-cascade.sql',
  ]);
}

function applyMigrations() {
  for (const migration of [
    '202611200001_learning_schema.sql',
    '202611200002_learning_writes.sql',
    '202611200003_learning_summaries.sql',
  ]) {
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
      'kaq_data',
      '-f',
      `/migrations/${migration}`,
    ]);
  }
}

try {
  run('docker', [...compose, 'up', '-d', '--wait', 'database', 'auth']);
  applyMigrations();
  run('docker', [...compose, 'up', '-d', 'rest']);
  await waitForRest();
  const [first, second] = await createSessions();
  psql(first.user.id, second.user.id);
  await verifyPostgrest(first, second);
  await verifyConcurrentRevisions(second.user.id);
} finally {
  run('docker', [...compose, 'down', '--volumes']);
}
