import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { artifacts } from './settings';

const directories = [
  'supabase/migrations',
  'test/account-merge',
  'node_modules/@supabase/auth-js/src',
  'node_modules/@supabase/auth-js/dist',
];
const files = [
  'test/account-sdk/sql.ts',
  'scripts/run-account-merge-integration.ts',
  'scripts/account-foundation-boundary.ts',
  'scripts/account-owner-cutover-manifest.json',
  'scripts/owner-shadow-production.ts',
  'scripts/owner-shadow-production-contract.ts',
  'scripts/owner-shadow-production-review.ts',
  'scripts/owner-shadow-production-transport.ts',
  'scripts/data-migrations.ts',
  'playwright.account-merge.config.ts',
  'package.json',
  'bun.lock',
  'patches/@supabase%2Fauth-js@2.119.2.patch',
  '.github/workflows/account-merge.yml',
  'node_modules/@supabase/auth-js/package.json',
];

function collect(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && /\.(?:ts|tsx|js|sql|py|json|yml|html|conf)$/.test(path) ? [path] : [];
  });
}

function hashes(): Record<string, string> {
  return Object.fromEntries(
    [...files, ...directories.flatMap(collect)]
      .sort()
      .map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
  );
}

export function captureNativeInputs() {
  const before = hashes();
  const write = (status: 'captured' | 'passed') =>
    writeFileSync(
      `${artifacts}/native-input-integrity.json`,
      `${JSON.stringify({ status, observedAt: new Date().toISOString(), inputs: before }, null, 2)}\n`,
    );
  write('captured');
  return () => {
    assert.deepEqual(hashes(), before, 'Native integration inputs changed during verification');
    write('passed');
  };
}
