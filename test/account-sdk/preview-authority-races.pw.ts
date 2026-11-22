import { expect, test } from '@playwright/test';
import { rejectScopeAfterStateBarrier } from '../account-merge/intent-scope-races';
import { loginMain } from './browser-fixture';
import { closeScopeContext, proveScopeOwners } from './intent-scope-flow';
import { prepareScopePreview } from './intent-scope-http';
import { startSdkAdapter } from './server';
import { json, literal, sql } from './sql';

const previewTables = [
  'account_merge_resolution_choices',
  'account_merge_deferred_rows',
  'account_merge_resume_heads',
  'account_merge_replay_heads',
  'account_merge_lineage_closure',
] as const;

const cases = [
  { name: 'auth-only attach', kind: 'add_existing' as const, targetExisting: false },
  { name: 'source existing target auth-only', kind: 'merge_existing' as const, targetExisting: false },
  { name: 'both existing owners', kind: 'merge_existing' as const, targetExisting: true },
];

for (const item of cases) {
  test(`preview authority rejects a lower-lock state mutation for ${item.name}`, async ({ browser }) => {
    const adapter = await startSdkAdapter({
      intentKind: item.kind,
      targetExisting: item.targetExisting,
      additionalPrivateTables: previewTables,
      cleanupReceiptFilename: `sdk-preview-authority-races-${item.kind.replace('_', '-')}-${item.targetExisting ? 'two-owner' : 'auth-only'}-cleanup.json`,
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginMain(page);
      await page.goto('/test/account-sdk/browser.html');
      const target = await proveScopeOwners(page, adapter);
      const { intent, sourceScope } = adapter.intent();
      const { accountId, generation } = json<{ accountId: string; generation: string }>(
        `select json_build_object('accountId',coalesce(intent.source_account_id,intent.target_account_id),'generation',state.generation::text)::text from kaq_private.account_intents intent join public.learning_state state on state.user_id=coalesce(intent.source_account_id,intent.target_account_id) where intent.id=${literal(intent.id)}::uuid`,
      );
      const request = () =>
        prepareScopePreview(page, intent.id, intent.secret, target.revision, sourceScope);
      const result = await rejectScopeAfterStateBarrier({
        accountId,
        label: `preview_state_changed_${item.kind}`,
        request,
        mutation: `update public.learning_state set generation=generation+1 where user_id=${literal(accountId)}::uuid`,
        restore: () =>
          sql(
            `update public.learning_state set generation=${literal(generation)}::bigint where user_id=${literal(accountId)}::uuid`,
          ),
        expected: { status: 409, code: 'PT409', message: 'KAQ_INTENT_SCOPE_RETRY' },
      });
      expect(result.restored).toBe(true);
    } finally {
      await closeScopeContext(context, adapter);
    }
  });
}
