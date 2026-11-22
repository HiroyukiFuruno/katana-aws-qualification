import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { ProofConnection } from './proof-connection';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';

export function proofGrantLock(get: () => GrantFixture) {
  test('proof issuer takes intent before state and replay remains one grant', async () => {
    const actor = get().actors[0];
    const ids: { intent: string; proof: string; receipt: string } = JSON.parse(
      sql(`
      select json_build_object('intent',i.id,'proof',p.id,'receipt',r.id)
      from kaq_private.account_intents i
      join kaq_private.account_proofs p on p.intent_id=i.id
      join kaq_private.account_merge_receipts r on r.intent_id=i.id
      where i.actor_uid=${quote(actor.userId)} and p.auth_uid=${quote(actor.userId)} and i.state='committed'`),
    );
    const before = grantHash();
    const holder = await new ProofConnection().open();
    let pending: ReturnType<typeof grantRpc> | undefined;
    try {
      holder.send(`select 1 from kaq_private.account_intents where id=${quote(ids.intent)} for update;
        select 'grant_intent_locked';`);
      await holder.wait('grant_intent_locked');
      pending = grantRpc(actor, 'issue_learning_session_grant', {
        p_reason: 'proof',
        p_proof_id: ids.proof,
        p_receipt_id: ids.receipt,
      });
      expect((await holder.blocked()).length).toBeGreaterThan(0);
      // issuerがintent待機中にstate SHAREを先取りしていれば、このNOWAITは失敗する。
      holder.send(`select 1 from public.learning_state where user_id=${quote(actor.userId)} for update nowait;
        select 'grant_state_order_verified';`);
      await holder.wait('grant_state_order_verified');
      await holder.finish();
      const result = await pending;
      pending = undefined;
      expect(result.ok).toBe(true);
      expect(grantHash()).toBe(before);
    } finally {
      await holder.abort();
      await pending?.catch(() => undefined);
    }
  });
}
