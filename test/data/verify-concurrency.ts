import { spawn, spawnSync } from 'node:child_process';

const compose = ['compose', '-f', 'test/data/compose.yml'];
const base = [
  'exec',
  '-T',
  'database',
  'psql',
  '-X',
  '-A',
  '-t',
  '-q',
  '-v',
  'ON_ERROR_STOP=1',
  '-v',
  'VERBOSITY=verbose',
  '-U',
  'supabase_auth_admin',
  '-d',
  'kaq_data',
];

export class PsqlSession {
  readonly child = spawn('docker', [...compose, ...base], { stdio: ['pipe', 'pipe', 'pipe'] });
  readonly completion: Promise<number | null>;
  stdout = '';
  stderr = '';
  constructor() {
    this.child.stdin.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EPIPE') throw error;
    });
    this.completion = new Promise((resolve, reject) => {
      this.child.once('error', reject);
      this.child.once('close', resolve);
    });
    this.child.stdout.on('data', (chunk: Buffer) => {
      this.stdout += chunk.toString();
    });
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString();
    });
  }
  write(sql: string) {
    this.child.stdin.write(`${sql}\n`);
  }
  async waitFor(pattern: RegExp) {
    const deadline = Date.now() + 10_000;
    while (!pattern.test(this.stdout)) {
      if (this.child.exitCode !== null)
        throw new Error(this.stderr || 'interactive psql exited before barrier');
      if (Date.now() >= deadline) throw new Error(`interactive psql barrier timeout: ${this.stderr}`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  async finish() {
    if (this.child.exitCode === null && !this.child.stdin.destroyed) this.child.stdin.end('\\q\n');
    return { status: await this.completion, stderr: this.stderr };
  }
}

function claim(userId: string) {
  return `set local role authenticated; select set_config('request.jwt.claims', jsonb_build_object('sub', '${userId}', 'role', 'authenticated')::text, true);`;
}
export function sql(command: string) {
  const result = spawnSync('docker', [...compose, ...base, '-c', command], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  return result.stdout.trim();
}
async function waitForLock(pid: string) {
  const deadline = Date.now() + 10_000;
  while (sql(`select wait_event_type = 'Lock' from pg_stat_activity where pid = ${pid}`) !== 't') {
    if (Date.now() >= deadline) throw new Error(`second transaction ${pid} did not wait for a row lock`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
async function assertConcurrent(userId: string, firstWrite: string, secondWrite: string, state: string) {
  const first = new PsqlSession();
  first.write(`begin; ${claim(userId)} ${firstWrite} select 'row-lock-acquired';`);
  await first.waitFor(/row-lock-acquired/);
  const second = new PsqlSession();
  second.write('select pg_backend_pid();');
  await second.waitFor(/^\d+\s*$/m);
  const pid = second.stdout.match(/^\d+\s*$/m)?.[0].trim();
  if (!pid) throw new Error('second transaction pid was not returned');
  second.write(`begin; ${claim(userId)} ${secondWrite} commit;`);
  await waitForLock(pid);
  first.write('commit;');
  if ((await first.finish()).status !== 0) throw new Error('lock-holder transaction failed');
  const result = await second.finish();
  if (result.status === 0 || !new RegExp(`\\b${state}\\b`).test(result.stderr))
    throw new Error(`expected SQLSTATE ${state}, got: ${result.stderr}`);
}
export async function verifyConcurrentRevisions(userId: string) {
  sql(`begin; ${claim(userId)} select public.initialize_learning_state(); commit;`);
  await assertConcurrent(
    userId,
    "select public.replace_roadmap_profile('[]', '{}', 0, 0);",
    "select public.replace_roadmap_profile('[]', '{}', 0, 0);",
    'PT412',
  );
  sql(
    `begin; ${claim(userId)} select public.start_exam_session('60000000-0000-0000-0000-000000000001', 'saa-c03', '2026-11', jsonb_build_array(jsonb_build_object('question_id', 'q', 'question_revision', 1)), 60000, 0); commit;`,
  );
  const save =
    "select public.save_exam_response('60000000-0000-0000-0000-000000000001', 0, 0, 0, jsonb_build_object('question_id', 'q', 'question_revision', 1), '[]', false, 0, null);";
  await assertConcurrent(userId, save, save, 'PT412');
  const stale =
    "select public.append_learning_event(jsonb_build_object('event_id', '60000000-0000-0000-0000-000000000002', 'schema_version', 1, 'certification_id', 'saa-c03', 'question_id', 'q', 'question_revision', 1, 'source_version', '2026-11', 'category', 'security', 'mode', 'study', 'answered_at', '2026-01-01T00:00:00Z', 'selected', '[]', 'correct', '[]', 'is_correct', false, 'duration_ms', 0, 'attempt_number', 1, 'prior_incorrect_count', 0, 'reward', 0), 0);";
  await assertConcurrent(userId, 'select public.reset_my_learning_data(0);', stale, 'PT409');
}
