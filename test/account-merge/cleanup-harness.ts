import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { artifacts } from './settings';

type Receipt = {
  status: string;
  sqlUnit: { status: string; checks: number };
  sdk: { status: string; assertions: Record<string, boolean> };
  deadlockErrors: number;
  baselineRestored: boolean;
  baselineSnapshot: unknown;
  finalSnapshot: unknown;
  legacyRed: { normalReadIsNull: boolean; nullRevisionDelete: string };
};

function python(args: string[]) {
  return spawnSync('python3', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PYTHONPATH: 'test/account-merge', PYTHONDONTWRITEBYTECODE: '1' },
  });
}

export async function verifyCleanupHarness() {
  const directory = `${artifacts}/cleanup-harness`;
  mkdirSync(directory, { recursive: true });
  const unit = python(['-m', 'unittest', 'cleanup_harness.test_support']);
  const result =
    unit.status === 0
      ? python(['-m', 'cleanup_harness', '--repo-root', process.cwd(), '--artifact-dir', directory])
      : undefined;
  writeFileSync(
    `${directory}/driver.log`,
    `unit:\n${unit.stdout ?? ''}${unit.stderr ?? ''}\nfixture:\n${result?.stdout ?? ''}${result?.stderr ?? ''}`,
  );
  if (unit.error) throw unit.error;
  if (unit.status !== 0) throw new Error(`Cleanup harness unit failed: ${unit.status}`);
  if (result?.error) throw result.error;
  if (result?.status !== 0) throw new Error(`Private cleanup harness failed: ${result?.status}`);
  const value: unknown = JSON.parse(readFileSync(`${directory}/actual-results.json`, 'utf8'));
  assert(value && typeof value === 'object');
  const receipt = value as Receipt;
  assert.equal(receipt.status, 'passed');
  assert.deepEqual(receipt.sqlUnit, { status: 'passed', checks: 19 });
  assert.deepEqual(receipt.legacyRed, {
    normalReadIsNull: true,
    nullRevisionDelete: 'conflict',
  });
  assert.deepEqual(receipt.sdk, {
    status: 'passed',
    assertions: { cancel: true, expire: true, staleRevision: true, oldContext: true },
  });
  assert.equal(receipt.deadlockErrors, 0);
  assert.equal(receipt.baselineRestored, true);
  assert.deepEqual(receipt.finalSnapshot, receipt.baselineSnapshot);
}
