import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { artifacts } from './settings';

type Receipt = {
  status: string;
  unit: { status: string; checks: number };
  baselineRestored: boolean;
  baselineSnapshot: unknown;
  finalSnapshot: unknown;
  scenarios: Record<string, unknown>;
};

export async function verifyRuntimeHarness() {
  const directory = `${artifacts}/runtime-harness`;
  mkdirSync(directory, { recursive: true });
  const result = spawnSync(
    'python3',
    ['-m', 'runtime_harness', '--repo-root', process.cwd(), '--artifact-dir', directory],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PYTHONPATH: 'test/account-merge', PYTHONDONTWRITEBYTECODE: '1' },
    },
  );
  writeFileSync(`${directory}/driver.log`, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Private runtime harness failed: ${result.status}`);
  const value: unknown = JSON.parse(readFileSync(`${directory}/actual-results.json`, 'utf8'));
  assert(value && typeof value === 'object');
  const receipt = value as Receipt;
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.unit?.status, 'passed');
  assert.equal(receipt.unit?.checks, 121);
  assert.equal(receipt.baselineRestored, true);
  assert.deepEqual(receipt.finalSnapshot, receipt.baselineSnapshot);
  assert(receipt.scenarios && typeof receipt.scenarios === 'object');
  assert.deepEqual(Object.keys(receipt.scenarios).sort(), [
    'cleanupAfterPromotion',
    'concurrentInitial',
    'promotionOnce',
    'revisionRace',
    'staleContextRace',
  ]);
}
