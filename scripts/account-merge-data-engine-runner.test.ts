import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const native = readFileSync('test/account-merge/data-engine.pw.ts', 'utf8');
const nativeSupport = readFileSync('test/account-merge/data-engine-native-support.ts', 'utf8');
const nativePayload = readFileSync('test/account-merge/data-engine-native-payload.ts', 'utf8');
const integration = readFileSync('scripts/run-account-data-engine-integration.ts', 'utf8');

test('native runner installs unregistered SQL over stdin, executes real OAuth first, and cleans its own owners', () => {
  expect(integration).toContain('function applySource(path: string)');
  expect(integration).toContain("'supabase/account-merge/learning-snapshot.sql'");
  expect(integration).toContain("'--config=playwright.account-merge.config.ts'");
  expect(integration).toContain('captureNativeInputs');
  expect(integration).toContain('dataEnginePublicSeed');
  expect(integration.indexOf("'--config=playwright.account-merge.config.ts'")).toBeLessThan(
    integration.indexOf('applyProposal();'),
  );
  expect(native).toContain('verifyDataEngine()');
  expect(nativeSupport).toContain("await admin('DELETE', '', ownerId)");
  expect(nativeSupport).toContain("await admin('GET', '', ownerId)");
  expect(native).toContain('unrelatedOwnerRows');
  expect(native).toContain('real OIDC, GoTrue, PostgREST, and Postgres');
  expect(native).toContain("'sdk-first'");
  expect(native).toContain("'sdk-second'");
  expect(nativePayload).toContain('submitted_legacy_exams');
  expect(native).toContain('createNonLegacyGuestVariants');
});
