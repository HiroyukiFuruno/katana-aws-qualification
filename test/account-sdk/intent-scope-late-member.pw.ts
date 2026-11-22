import { expect, test } from '@playwright/test';
import { ProofConnection } from '../account-merge/proof-connection';
import { loginMain } from './browser-fixture';
import { closeScopeContext, proveScopeOwners } from './intent-scope-flow';
import { lockScope } from './intent-scope-http';
import { startSdkAdapter } from './server';
import { json, literal, sql } from './sql';

test('intent scope rejects a member discovered after Auth locks and before the account snapshot', async ({
  browser,
}) => {
  const adapter = await startSdkAdapter({
    intentKind: 'merge_existing',
    cleanupReceiptFilename: 'sdk-intent-scope-late-member-cleanup.json',
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const holder = await new ProofConnection().open();
  let pending: Promise<{ status: number; body: unknown }> | undefined;
  let aliasUid: string | undefined;
  let accountId: string | undefined;
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    const target = await proveScopeOwners(page, adapter);
    const { intent, sourceScope } = adapter.intent();
    if (!sourceScope) throw new Error('Missing source ownership scope');
    aliasUid = sourceScope.accountId;
    accountId = sourceScope.accountId;
    const rows = json<{ actor: string; target: string; revision: string }>(
      `select json_build_object('actor',actor_uid,'target',target_uid,'revision',account.membership_revision::text)::text
       from kaq_private.account_intents intent
       join kaq_private.learning_accounts account on account.id=intent.source_account_id
       where intent.id=${literal(intent.id)}::uuid`,
    );
    const initialMemberUids = json<string[]>(
      `select coalesce(json_agg(auth_user_id order by auth_user_id),'[]'::json)::text
       from kaq_private.learning_memberships where account_id=${literal(accountId)}::uuid`,
    );
    expect([rows.actor, rows.target, ...initialMemberUids]).not.toContain(aliasUid);
    expect(sql(`select exists(select 1 from auth.users where id=${literal(aliasUid)}::uuid)`)).toBe('t');
    expect(
      sql(
        `select exists(select 1 from kaq_private.learning_memberships where auth_user_id=${literal(aliasUid)}::uuid)`,
      ),
    ).toBe('f');
    holder.send(
      "lock table kaq_private.learning_accounts in access exclusive mode; select 'late_member_accounts_locked';",
    );
    await holder.wait('late_member_accounts_locked');
    pending = lockScope(page, intent.id, intent.secret, target.revision, sourceScope);
    const graph = await holder.blocked();
    const scopePid = graph[0]?.waiter;
    if (!scopePid) throw new Error('Missing scope waiter');
    expect(
      sql(`select exists(select 1 from pg_locks lock where lock.pid=${scopePid}
        and lock.relation='kaq_private.learning_accounts'::regclass and lock.mode='AccessShareLock'
        and not lock.granted)`),
    ).toBe('t');
    holder.send(
      `select 1 from kaq_private.learning_accounts where id=${literal(accountId)}::uuid;
       insert into kaq_private.learning_memberships(auth_user_id,account_id)
       values(${literal(aliasUid)}::uuid,${literal(accountId)}::uuid);
       select 'late_member_inserted';`,
    );
    await holder.wait('late_member_inserted');
    await holder.finish(true);
    expect(
      sql(
        `select membership_revision::text from kaq_private.learning_accounts where id=${literal(accountId)}::uuid`,
      ),
    ).toBe(rows.revision);
    expect(await pending).toMatchObject({
      status: 409,
      body: { code: 'PT409', message: 'KAQ_INTENT_SCOPE_RETRY' },
    });
  } finally {
    await holder.abort();
    if (pending) await pending.catch(() => undefined);
    if (aliasUid && accountId)
      sql(
        `delete from kaq_private.learning_memberships where auth_user_id=${literal(aliasUid)}::uuid and account_id=${literal(accountId)}::uuid`,
      );
    await closeScopeContext(context, adapter);
  }
});
