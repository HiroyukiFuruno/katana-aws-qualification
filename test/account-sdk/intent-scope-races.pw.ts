import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { rejectScopeAfterStateBarrier, waitForSqlCondition } from '../account-merge/intent-scope-races';
import { artifacts } from '../account-merge/settings';
import { loginMain } from './browser-fixture';
import { closeScopeContext, proveScopeOwners } from './intent-scope-flow';
import { lockScope } from './intent-scope-http';
import { startSdkAdapter } from './server';
import { json, literal, sql } from './sql';

type ScopeRows = {
  account: string;
  actor: string;
  target: string;
  epoch: string;
  revision: string;
  generation: string;
  expires: string;
  leg: string;
  legExpires: string;
};

test('intent scope rejects lower-lock membership, revision, state, and expiry invalidations', async ({
  browser,
}) => {
  const adapter = await startSdkAdapter({
    intentKind: 'merge_existing',
    cleanupReceiptFilename: 'sdk-intent-scope-races-cleanup.json',
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    const target = await proveScopeOwners(page, adapter);
    const revision = target.revision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision))
      throw new Error('Missing final intent revision');
    const intent = adapter.intent().intent;
    const rows =
      json<ScopeRows>(`select json_build_object('account',intent.source_account_id,'actor',intent.actor_uid,
      'target',intent.target_uid,'epoch',member.epoch::text,'revision',account.membership_revision::text,
      'generation',state.generation::text,'expires',intent.expires_at::text,
      'leg',(select proof.leg_id from kaq_private.account_proofs proof join kaq_private.account_proof_legs leg on leg.id=proof.leg_id
        where proof.intent_id=intent.id and leg.side='source'),
      'legExpires',(select leg.expires_at::text from kaq_private.account_proofs proof join kaq_private.account_proof_legs leg on leg.id=proof.leg_id
        where proof.intent_id=intent.id and leg.side='source')) from kaq_private.account_intents intent
      join kaq_private.learning_memberships member on member.auth_user_id=intent.actor_uid
      join kaq_private.learning_accounts account on account.id=member.account_id
      join public.learning_state state on state.user_id=account.id where intent.id=${literal(intent.id)}::uuid`);
    const request = () =>
      lockScope(page, intent.id, intent.secret, revision, adapter.intent().sourceScope);
    const retry = { status: 409, code: 'PT409', message: 'KAQ_INTENT_SCOPE_RETRY' };
    const cases = {
      memberAdded: await rejectScopeAfterStateBarrier({
        accountId: rows.account,
        label: 'member_added',
        request,
        mutation: `insert into kaq_private.learning_memberships(auth_user_id,account_id) values(${literal(rows.target)}::uuid,${literal(rows.account)}::uuid)`,
        restore: () =>
          sql(
            `delete from kaq_private.learning_memberships where auth_user_id=${literal(rows.target)}::uuid`,
          ),
        expected: retry,
      }),
      epochChanged: await rejectScopeAfterStateBarrier({
        accountId: rows.account,
        label: 'epoch_changed',
        request,
        mutation: `update kaq_private.learning_memberships set epoch=epoch+1 where auth_user_id=${literal(rows.actor)}::uuid`,
        restore: () =>
          sql(
            `update kaq_private.learning_memberships set epoch=${literal(rows.epoch)}::bigint where auth_user_id=${literal(rows.actor)}::uuid`,
          ),
        expected: retry,
      }),
      revisionChanged: await rejectScopeAfterStateBarrier({
        accountId: rows.account,
        label: 'revision_changed',
        request,
        mutation: `update kaq_private.learning_accounts set membership_revision=membership_revision+1 where id=${literal(rows.account)}::uuid`,
        restore: () =>
          sql(
            `update kaq_private.learning_accounts set membership_revision=${literal(rows.revision)}::bigint where id=${literal(rows.account)}::uuid`,
          ),
        expected: retry,
      }),
      stateChanged: await rejectScopeAfterStateBarrier({
        accountId: rows.account,
        label: 'state_changed',
        request,
        mutation: `update public.learning_state set generation=generation+1 where user_id=${literal(rows.account)}::uuid`,
        restore: () =>
          sql(
            `update public.learning_state set generation=${literal(rows.generation)}::bigint where user_id=${literal(rows.account)}::uuid`,
          ),
        expected: retry,
      }),
    };
    sql(
      `update kaq_private.account_intents set expires_at=clock_timestamp()+interval '500 milliseconds' where id=${literal(intent.id)}::uuid`,
    );
    const ttl = await rejectScopeAfterStateBarrier({
      accountId: rows.account,
      label: 'intent_expired',
      request,
      restore: () =>
        sql(
          `update kaq_private.account_intents set expires_at=${literal(rows.expires)}::timestamptz where id=${literal(intent.id)}::uuid`,
        ),
      expected: { status: 409, code: 'PT409', message: 'KAQ_INTENT_EXPIRED' },
      beforeRelease: () =>
        waitForSqlCondition(
          `select expires_at <= clock_timestamp() from kaq_private.account_intents where id=${literal(intent.id)}::uuid`,
          'Intent',
        ),
    });
    sql(
      `update kaq_private.account_proof_legs set expires_at=clock_timestamp()+interval '500 milliseconds' where id=${literal(rows.leg)}::uuid`,
    );
    const legTtl = await rejectScopeAfterStateBarrier({
      accountId: rows.account,
      label: 'proof_leg_expired',
      request,
      restore: () =>
        sql(
          `update kaq_private.account_proof_legs set expires_at=${literal(rows.legExpires)}::timestamptz where id=${literal(rows.leg)}::uuid`,
        ),
      expected: retry,
      beforeRelease: () =>
        waitForSqlCondition(
          `select expires_at <= clock_timestamp() from kaq_private.account_proof_legs where id=${literal(rows.leg)}::uuid`,
          'Proof leg',
        ),
    });
    expect(await request()).toMatchObject({ status: 200 });
    writeFileSync(
      `${artifacts}/intent-scope-races.json`,
      `${JSON.stringify({ status: 'passed', cases, ttl, legTtl }, null, 2)}\n`,
    );
  } finally {
    await closeScopeContext(context, adapter);
  }
});
