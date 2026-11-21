import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { artifacts } from './settings';

type Result = {
  status: string;
  unitChecks: number;
  scenarioCount: number;
  deadlockErrors: number;
  unintendedWrites: number;
  scenarios: Record<string, unknown>;
};

function isResult(value: unknown): value is Result {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Record<string, unknown>;
  return (
    typeof receipt.status === 'string' &&
    typeof receipt.unitChecks === 'number' &&
    typeof receipt.scenarioCount === 'number' &&
    typeof receipt.deadlockErrors === 'number' &&
    typeof receipt.unintendedWrites === 'number' &&
    !!receipt.scenarios &&
    typeof receipt.scenarios === 'object' &&
    !Array.isArray(receipt.scenarios)
  );
}

function safeDriverOutput(value: string): string {
  return value
    .split('\n')
    .map((line) =>
      /access_token|refresh_token|authorization:\s*bearer|kaq-account-merge-only-jwt-secret-not-for-production/i.test(
        line,
      )
        ? '[redacted sensitive driver output]'
        : line,
    )
    .join('\n');
}

export async function verifyLockingHarness() {
  const artifactDir = `${artifacts}/locking-harness`;
  mkdirSync(artifactDir, { recursive: true });
  const options = {
    encoding: 'utf8' as const,
    env: { ...process.env, PYTHONPATH: 'test/account-merge', PYTHONDONTWRITEBYTECODE: '1' },
    maxBuffer: 10 * 1024 * 1024,
  };
  const unit = spawnSync('python3', ['-m', 'unittest', 'locking_harness.test_support'], options);
  const result =
    unit.status === 0
      ? spawnSync(
          'python3',
          ['-m', 'locking_harness', '--repo-root', process.cwd(), '--artifact-dir', artifactDir],
          options,
        )
      : undefined;
  writeFileSync(
    `${artifactDir}/driver.log`,
    safeDriverOutput(
      `unit:\n${unit.stdout ?? ''}${unit.stderr ?? ''}\nfixture:\n${result?.stdout ?? ''}${result?.stderr ?? ''}`,
    ),
  );
  if (unit.error) throw unit.error;
  if (unit.status !== 0) throw new Error(`locking harness unit tests failed: ${unit.status}`);
  if (!result) throw new Error('locking harness fixture was not started');
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`locking harness failed: ${result.status}`);
  const actual: unknown = JSON.parse(readFileSync(`${artifactDir}/actual-results.json`, 'utf8'));
  assert(isResult(actual), 'locking harness receipt has an invalid shape');
  const receipt = actual;
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.unitChecks, 108);
  assert.equal(receipt.scenarioCount, 12);
  assert.equal(receipt.deadlockErrors, 0);
  assert.equal(receipt.unintendedWrites, 0);
  assert.deepEqual(Object.keys(receipt.scenarios).sort(), [
    'candidate_add',
    'candidate_remove',
    'candidate_revision',
    'gotrue_refresh_session_conflict',
    'reentry_upgrade',
    'unsupported_isolation',
    'wait_then_expired_claim',
    'wait_then_expired_session',
    'writer_vs_auth_delete',
    'writer_vs_merge',
    'writer_vs_merge_revision',
    'writer_vs_reset',
  ]);
}
