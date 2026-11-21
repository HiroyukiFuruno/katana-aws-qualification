import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { artifacts } from './settings';

type Receipt = {
  status: string;
  unitChecks: number;
  scenarioCount: number;
  deadlocks: number;
  secretsLogged: boolean;
  intentDataRestored: boolean;
  scenarios: Record<string, unknown>;
};

function run(args: string[]) {
  return spawnSync('python3', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PYTHONPATH: 'test/account-merge', PYTHONDONTWRITEBYTECODE: '1' },
  });
}

export async function verifyIntentHarness() {
  const directory = `${artifacts}/intent-harness`;
  mkdirSync(directory, { recursive: true });
  const unit = run(['-m', 'unittest', 'intent_harness.test_intent']);
  const fixture =
    unit.status === 0
      ? run(['-m', 'intent_harness', '--repo-root', process.cwd(), '--artifact-dir', directory])
      : undefined;
  writeFileSync(
    `${directory}/driver.log`,
    `unit:\n${unit.stdout ?? ''}${unit.stderr ?? ''}\nfixture:\n${fixture?.stdout ?? ''}${fixture?.stderr ?? ''}`,
  );
  if (unit.error) throw unit.error;
  if (unit.status !== 0) throw new Error(`intent harness unit failed: ${unit.status}`);
  if (fixture?.error) throw fixture.error;
  if (fixture?.status !== 0) throw new Error(`intent harness failed: ${fixture?.status}`);
  const value: unknown = JSON.parse(readFileSync(`${directory}/actual-results.json`, 'utf8'));
  assert(value && typeof value === 'object');
  const receipt = value as Receipt;
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.unitChecks, 83);
  assert.equal(receipt.scenarioCount, 9);
  assert.equal(receipt.deadlocks, 0);
  assert.equal(receipt.secretsLogged, false);
  assert.equal(receipt.intentDataRestored, true);
  assert(receipt.scenarios && typeof receipt.scenarios === 'object');
  assert.deepEqual(Object.keys(receipt.scenarios).sort(), [
    'cancel_before_restart',
    'commit_terminal_precedes_cancel',
    'expiry_after_intent_wait',
    'live_after_advisory_wait_claim',
    'live_after_advisory_wait_session',
    'parallel_cancel',
    'parallel_different_key',
    'parallel_rate_limit',
    'parallel_same_key',
  ]);
}
