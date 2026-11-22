import { expect, test } from '@playwright/test';
import { ProofConnection } from '../account-merge/proof-connection';
import { loginMain } from './browser-fixture';
import { closeScopeContext, proveScopeOwners } from './intent-scope-flow';
import { lockScope } from './intent-scope-http';
import { startSdkAdapter } from './server';
import { json, literal } from './sql';

test('intent scope holds the Auth actor row before its lower state barrier', async ({ browser }) => {
  const adapter = await startSdkAdapter({
    intentKind: 'merge_existing',
    cleanupReceiptFilename: 'sdk-intent-scope-auth-delete-cleanup.json',
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const stateHolder = await new ProofConnection().open();
  const deletion = await new ProofConnection().open();
  let request: Promise<{ status: number; body: unknown }> | undefined;
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    const target = await proveScopeOwners(page, adapter);
    const revision = target.revision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision))
      throw new Error('Missing final intent revision');
    const intent = adapter.intent().intent;
    const rows = json<{ actor: string; account: string }>(`select json_build_object('actor',actor_uid,
      'account',source_account_id) from kaq_private.account_intents where id=${literal(intent.id)}::uuid`);
    stateHolder.send(
      `select 1 from public.learning_state where user_id=${literal(rows.account)}::uuid for update; select 'state_locked';`,
    );
    await stateHolder.wait('state_locked');
    request = lockScope(page, intent.id, intent.secret, revision, adapter.intent().sourceScope);
    const stateGraph = await stateHolder.blocked();
    deletion.send(
      `delete from auth.users where id=${literal(rows.actor)}::uuid; select 'delete_uncommitted';`,
    );
    const deletionGraph = await deletion.blocked(stateGraph[0]?.waiter, deletion.pid);
    await stateHolder.finish();
    expect((await request).status).toBe(200);
    await deletion.wait('delete_uncommitted');
    await deletion.finish();
    expect(deletionGraph).toHaveLength(1);
  } finally {
    await stateHolder.abort();
    await deletion.abort();
    if (request) await request.catch(() => undefined);
    await closeScopeContext(context, adapter);
  }
});

test('intent scope holds a proof OAuth AMR row before its lower state barrier', async ({ browser }) => {
  const adapter = await startSdkAdapter({
    intentKind: 'merge_existing',
    cleanupReceiptFilename: 'sdk-intent-scope-auth-amr-cleanup.json',
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const stateHolder = await new ProofConnection().open();
  const amrUpdate = await new ProofConnection().open();
  let request: Promise<{ status: number; body: unknown }> | undefined;
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    const target = await proveScopeOwners(page, adapter);
    const revision = target.revision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision))
      throw new Error('Missing final intent revision');
    const intent = adapter.intent().intent;
    const rows = json<{
      account: string;
      session: string;
    }>(`select json_build_object('account',intent.source_account_id,
      'session',proof.session_id) from kaq_private.account_intents intent join kaq_private.account_proofs proof on proof.intent_id=intent.id
      join kaq_private.account_proof_legs leg on leg.id=proof.leg_id where intent.id=${literal(intent.id)}::uuid and leg.side='source'`);
    stateHolder.send(
      `select 1 from public.learning_state where user_id=${literal(rows.account)}::uuid for update; select 'state_locked';`,
    );
    await stateHolder.wait('state_locked');
    request = lockScope(page, intent.id, intent.secret, revision, adapter.intent().sourceScope);
    const stateGraph = await stateHolder.blocked();
    const scopePid = stateGraph[0]?.waiter;
    if (!scopePid) throw new Error('Missing scope waiter');
    amrUpdate.send(`update auth.mfa_amr_claims set updated_at=updated_at where session_id=${literal(rows.session)}::uuid
      and authentication_method='oauth'; select 'amr_update_uncommitted';`);
    const amrGraph = await amrUpdate.blocked(scopePid, amrUpdate.pid);
    await stateHolder.finish();
    expect((await request).status).toBe(200);
    await amrUpdate.wait('amr_update_uncommitted');
    await amrUpdate.finish();
    expect(amrGraph).toHaveLength(1);
  } finally {
    await stateHolder.abort();
    await amrUpdate.abort();
    if (request) await request.catch(() => undefined);
    await closeScopeContext(context, adapter);
  }
});
