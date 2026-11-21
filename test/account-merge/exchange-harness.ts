import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { artifacts } from './settings';

type Receipt = {
  status: string;
  unit: { status: string; checks: number; names: string[] };
  baselineRestored: boolean;
  baselineSnapshot: unknown;
  finalSnapshot: unknown;
  deadlocks: number;
  realSessionChecks: { users: number; sessions: number; signatureAndGetUserVerified: boolean };
  scenarios: Record<string, unknown>;
};

function python(args: string[]) {
  return spawnSync('python3', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PYTHONPATH: 'test/account-merge', PYTHONDONTWRITEBYTECODE: '1' },
  });
}

export async function verifyExchangeHarness() {
  const directory = `${artifacts}/exchange-harness`;
  mkdirSync(directory, { recursive: true });
  const unit = python(['-m', 'unittest', 'exchange_harness.test_support']);
  const result =
    unit.status === 0
      ? python(['-m', 'exchange_harness', '--repo-root', process.cwd(), '--artifact-dir', directory])
      : undefined;
  writeFileSync(
    `${directory}/driver.log`,
    `unit:\n${unit.stdout ?? ''}${unit.stderr ?? ''}\nfixture:\n${result?.stdout ?? ''}${result?.stderr ?? ''}`,
  );
  if (unit.error) throw unit.error;
  if (unit.status !== 0) throw new Error(`Exchange harness unit failed: ${unit.status}`);
  if (result?.error) throw result.error;
  if (result?.status !== 0) throw new Error(`Private exchange harness failed: ${result?.status}`);
  const value: unknown = JSON.parse(readFileSync(`${directory}/actual-results.json`, 'utf8'));
  assert(value && typeof value === 'object');
  const receipt = value as Receipt;
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.unit?.status, 'passed');
  assert.equal(receipt.unit?.checks, 125);
  assert.equal(receipt.unit.names.length, 125);
  assert.equal(new Set(receipt.unit.names).size, 125);
  assert.equal(receipt.baselineRestored, true);
  assert.deepEqual(receipt.finalSnapshot, receipt.baselineSnapshot);
  assert.equal(receipt.deadlocks, 0);
  assert.deepEqual(receipt.realSessionChecks, {
    users: 3,
    sessions: 4,
    signatureAndGetUserVerified: true,
  });
  assert(receipt.scenarios && typeof receipt.scenarios === 'object');
  assert.deepEqual(Object.keys(receipt.scenarios).sort(), [
    'completeVsCancel',
    'expiryAfterLegWait',
    'expiryAfterRuntimeWait',
    'lateFailureVsProofPromotion',
    'parallelAuthorizationClaim',
    'parallelExchangeClaim',
    'runtimeChangeVsExchange',
  ]);
}
