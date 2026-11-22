import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { artifacts } from './settings';

const directories = [
  'supabase/migrations',
  'supabase/account-merge',
  'supabase/functions/account-linking',
  'test/account-merge',
  'test/account-sdk',
  'node_modules/@supabase/auth-js/src',
  'node_modules/@supabase/auth-js/dist',
];
const files = [
  'scripts/run-account-merge-integration.ts',
  'scripts/data-migrations.ts',
  'playwright.account-merge.config.ts',
  'playwright.account-grants.config.ts',
  'playwright.account-creation.config.ts',
  'playwright.account-sdk.config.ts',
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

export function captureNativeInputs(selection: { sdkGrep: string | null }) {
  const before = hashes();
  const write = (status: 'captured' | 'passed') =>
    writeFileSync(
      `${artifacts}/native-input-integrity.json`,
      `${JSON.stringify({ status, observedAt: new Date().toISOString(), sdkGrep: selection.sdkGrep, inputs: before }, null, 2)}\n`,
    );
  write('captured');
  return () => {
    assert.deepEqual(hashes(), before, 'Native integration inputs changed during verification');
    write('passed');
  };
}
