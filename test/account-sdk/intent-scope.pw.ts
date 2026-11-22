import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import type { IntentKind } from './control-fixture';
import { closeScopeContext, proveScopeOwners } from './intent-scope-flow';
import { lockScope, type ScopeReply } from './intent-scope-http';
import { startSdkAdapter } from './server';

const cases: { name: string; kind: IntentKind; targetExisting: boolean; accounts: number }[] = [
  { name: 'add-existing target owner', kind: 'add_existing', targetExisting: false, accounts: 1 },
  {
    name: 'merge-existing auth-only target',
    kind: 'merge_existing',
    targetExisting: false,
    accounts: 1,
  },
  {
    name: 'merge-existing distinct target owner',
    kind: 'merge_existing',
    targetExisting: true,
    accounts: 2,
  },
];

for (const item of cases) {
  test(`intent scope locks ${item.name} through signed HTTP`, async ({ browser }) => {
    const adapter = await startSdkAdapter({
      intentKind: item.kind,
      targetExisting: item.targetExisting,
      cleanupReceiptFilename: `sdk-intent-scope-${item.kind.replace('_', '-')}-${item.targetExisting ? 'two-owner' : 'auth-only'}-cleanup.json`,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginMain(page);
      await page.goto('/test/account-sdk/browser.html');
      const before = await mainSessionSnapshot(page);
      const target = await proveScopeOwners(page, adapter);
      const revision = target.revision;
      if (typeof revision !== 'number' || !Number.isSafeInteger(revision))
        throw new Error('Missing final intent revision');
      const intent = adapter.intent().intent;
      const stale = await lockScope(
        page,
        intent.id,
        intent.secret,
        revision - 1,
        adapter.intent().sourceScope,
      );
      expect(stale).toMatchObject({ status: 409, body: { code: 'PT409', message: 'KAQ_INTENT_STALE' } });
      const accepted = await lockScope(
        page,
        intent.id,
        intent.secret,
        revision,
        adapter.intent().sourceScope,
      );
      expect(accepted, JSON.stringify(accepted)).toMatchObject({ status: 200 });
      const scope = accepted.body as ScopeReply;
      expect(scope.operation).toBe('intent_scope');
      expect(scope.intent_id).toBe(intent.id);
      expect(scope.existing_account_ids).toHaveLength(item.accounts);
      expect(scope.generations).toHaveLength(item.accounts);
      expect(scope.membership_count).toEqual(expect.any(Number));
      expect(scope).not.toHaveProperty('memberships');
      expect(JSON.stringify(scope)).not.toMatch(/secret|nonce|token|digest|"uid"|"fence"/i);
      expect(await mainSessionSnapshot(page)).toEqual(before);
      writeFileSync(
        `${artifacts}/intent-scope-${item.kind}-${item.targetExisting ? 'two-owner' : 'auth-only'}.json`,
        `${JSON.stringify({ status: 'passed', signedHttp: true, kind: item.kind, scope }, null, 2)}\n`,
      );
    } finally {
      await closeScopeContext(context, adapter);
    }
  });
}
