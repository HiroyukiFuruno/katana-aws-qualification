import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serveProgressGateway } from '../test/progress/gateway';
import { authOrigin, gatewayOrigin, restOrigin } from '../test/progress/settings';

async function available(url: string) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function requireServices() {
  const missing = [];
  if (!(await available(`${authOrigin}/health`))) missing.push('GoTrue 54430');
  if (!(await available(`${restOrigin}/`))) missing.push('PostgREST 54431');
  if (missing.length)
    throw new Error(`Progress integration services are not ready: ${missing.join(', ')}`);
}

async function waitForRest() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await available(`${restOrigin}/`)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('PostgREST did not become ready.');
}

const dataRoot = resolve(import.meta.dir, '..');
const compose = ['compose', '-f', `${dataRoot}/test/data/compose.yml`];
const logFile = 'test-results/progress/integration.log';

function run(command: string, args: string[], capture = false) {
  const result = spawnSync(command, args, capture ? { encoding: 'utf8' } : { stdio: 'inherit' });
  if (capture) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    appendFileSync(logFile, output);
    process.stdout.write(output);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
}

function applyMigrations() {
  for (const migration of [
    '202611200001_learning_schema.sql',
    '202611200002_learning_writes.sql',
    '202611200003_learning_summaries.sql',
    '202611200004_profile_snapshot.sql',
    '202611200005_exam_clock.sql',
    '202611200006_revision_conflicts.sql',
  ]) {
    run(
      'docker',
      [
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
      ],
      true,
    );
  }
}

function verifyNoOrphanedLearningData() {
  run(
    'docker',
    [
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
      '-c',
      `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM public.learning_events e LEFT JOIN auth.users u ON u.id = e.user_id WHERE u.id IS NULL)
        OR EXISTS (SELECT 1 FROM public.learning_state s LEFT JOIN auth.users u ON u.id = s.user_id WHERE u.id IS NULL)
        OR EXISTS (SELECT 1 FROM public.roadmap_profiles p LEFT JOIN auth.users u ON u.id = p.user_id WHERE u.id IS NULL)
      THEN RAISE EXCEPTION 'orphaned learning data remains after account deletion'; END IF;
    END $$;`,
    ],
    true,
  );
}

async function waitForGateway() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await available(`${gatewayOrigin}/health`)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Progress gateway did not become ready.');
}

if (process.argv[2] === 'gateway') {
  const server = serveProgressGateway();
  console.log(`progress integration gateway listening on ${server.url}`);
} else {
  mkdirSync('test-results/progress', { recursive: true });
  writeFileSync(logFile, '');
  let gateway: ReturnType<typeof spawn> | undefined;
  try {
    run('docker', [...compose, 'up', '-d', '--wait', 'database', 'auth'], true);
    applyMigrations();
    run('docker', [...compose, 'up', '-d', 'rest'], true);
    await waitForRest();
    await requireServices();
    gateway = spawn('bun', ['scripts/run-progress-integration.ts', 'gateway'], { stdio: 'inherit' });
    await waitForGateway();
    run(
      'bunx',
      ['playwright', 'test', '--config=playwright.progress.config.ts', ...process.argv.slice(2)],
      true,
    );
    verifyNoOrphanedLearningData();
  } finally {
    gateway?.kill('SIGTERM');
    const logs = spawnSync('docker', [...compose, 'logs', '--no-color'], { encoding: 'utf8' });
    appendFileSync(logFile, `${logs.stdout ?? ''}${logs.stderr ?? ''}`);
    run('docker', [...compose, 'down', '--volumes'], true);
  }
}
