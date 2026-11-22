import { test } from '@playwright/test';
import { type GrantFixture, grantFixture } from './session-grants-fixture';
import { normalGrantCases } from './session-grants-normal';
import { normalGrantLock } from './session-grants-normal-lock';
import { normalGrantPolicy } from './session-grants-normal-policy';
import { normalGrantRefresh } from './session-grants-normal-refresh';
import { proofGrantCases } from './session-grants-proof';
import { proofGrantLock } from './session-grants-proof-lock';

test.describe('private session grant contract with real OAuth and PostgREST', () => {
  test.describe.configure({ mode: 'serial' });
  let fixture: GrantFixture | undefined;
  const get = () => {
    if (!fixture) throw new Error('Grant fixture was not initialized');
    return fixture;
  };
  test.beforeAll(async ({ browser }) => {
    fixture = await grantFixture(browser);
  });
  test.afterAll(async () => {
    await fixture?.close();
  });
  normalGrantCases(get);
  normalGrantPolicy(get);
  normalGrantLock(get);
  normalGrantRefresh(get);
  proofGrantCases(get);
  proofGrantLock(get);
});
