import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const runner = readFileSync('scripts/run-intent-scope-native.ts', 'utf8');

test('native intent-scope preflight does not restore a numeric migration boundary', () => {
  expect(runner).toContain('dataEngineMigrationPhases');
  expect(runner).not.toMatch(/migrations\.indexOf\('202611220001_learning_owner_shadow\.sql'\)/);
  expect(runner).not.toMatch(/ownerShadow\s*!==\s*\d+|migrations\.length\s*!==\s*\d+/);
});
