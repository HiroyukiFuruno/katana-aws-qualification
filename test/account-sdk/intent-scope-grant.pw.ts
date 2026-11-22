import { expect, test } from '@playwright/test';
import { rejectScopeAfterStateBarrier } from '../account-merge/intent-scope-races';
import { loginMain } from './browser-fixture';
import { closeScopeContext, proveScopeOwners } from './intent-scope-flow';
import { lockScope } from './intent-scope-http';
import { startSdkAdapter } from './server';
import { json, literal, sql } from './sql';

test('intent scope rejects a revoked main grant despite two fresh ownership proofs', async ({
  browser,
}) => {
  const adapter = await startSdkAdapter({
    intentKind: 'merge_existing',
    cleanupReceiptFilename: 'sdk-intent-scope-revoked-grant-cleanup.json',
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  let restore = '';
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    const target = await proveScopeOwners(page, adapter);
    const revision = target.revision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision))
      throw new Error('Missing intent revision');
    const { intent, sourceScope } = adapter.intent();
    const request = () => lockScope(page, intent.id, intent.secret, revision, sourceScope);
    expect((await request()).status).toBe(200);
    const { account } = json<{ account: string }>(
      `select json_build_object('account',source_account_id) from kaq_private.account_intents where id=${literal(intent.id)}::uuid`,
    );
    const predicate = `session_id=(select actor_session_id from kaq_private.account_intents where id=${literal(intent.id)}::uuid)`;
    expect(
      sql(
        `select count(*) from kaq_private.learning_session_grants where ${predicate} and revoked_at is null`,
      ),
    ).toBe('1');
    restore = `update kaq_private.learning_session_grants set revoked_at=null where ${predicate}`;
    sql(
      `update kaq_private.learning_session_grants set revoked_at=clock_timestamp() where ${predicate}`,
    );
    expect(await request()).toMatchObject({
      status: 401,
      body: { code: 'PT401', message: 'KAQ_REAUTHENTICATION_REQUIRED' },
    });
    sql(restore);
    restore = '';
    expect((await request()).status).toBe(200);
    const raced = await rejectScopeAfterStateBarrier({
      accountId: account,
      label: 'grant_revoked',
      request,
      mutation: `update kaq_private.learning_session_grants set revoked_at=clock_timestamp() where ${predicate}`,
      restore: () =>
        sql(`update kaq_private.learning_session_grants set revoked_at=null where ${predicate}`),
      expected: { status: 401, code: 'PT401', message: 'KAQ_REAUTHENTICATION_REQUIRED' },
    });
    expect(raced.restored).toBe(true);
  } finally {
    if (restore) sql(restore);
    await closeScopeContext(context, adapter);
  }
});
