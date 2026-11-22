import { expect, test } from '@playwright/test';
import { protectedHash } from '../account-sdk/server-snapshot';
import { sql } from './commands';
import { ProofConnection } from './proof-connection';
import { publicState } from './public-state';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';
import { seedCommittedGrantProofs } from './session-grants-proof-seed';

type ScopeChange = { label: string; statement: string; marker: string };

export function proofGrantBindingCases(get: () => GrantFixture) {
  test('proof issuer never creates a missing committed binding', async () => {
    const [first, second] = get().actors;
    const ids = seedCommittedGrantProofs(first, second, { binding: false });
    const proof = quote(ids.source);
    const intent = quote(ids.intent);
    const issue = () =>
      grantRpc(first, 'issue_learning_session_grant', {
        p_reason: 'proof',
        p_proof_id: ids.source,
        p_receipt_id: ids.receipt,
      });
    const assertRejected = async (label: string) => {
      const before = { grant: grantHash(), private: protectedHash(), public: publicState() };
      const result = await issue();
      expect(result.ok, label).toBe(false);
      expect(result.status, label).toBe(401);
      expect(JSON.stringify(result.value), label).toContain('KAQ_REAUTHENTICATION_REQUIRED');
      expect(grantHash(), `${label}: grant/binding`).toBe(before.grant);
      expect(protectedHash(), `${label}: private`).toBe(before.private);
      expect(publicState(), `${label}: public`).toEqual(before.public);
      expect(
        sql(`select count(*) from kaq_private.account_committed_proof_bindings where proof_id=${proof}`),
      ).toBe('0');
    };
    await assertRejected('missing binding without a scope change');
    for (const change of [
      {
        label: 'epoch changed before first issuer',
        statement: `update kaq_private.learning_memberships set epoch=epoch+1 where auth_user_id=${quote(first.userId)}`,
        marker: 'proof_binding_epoch_changed',
      },
      {
        label: 'fence changed before first issuer',
        statement: `update kaq_private.learning_accounts set session_fence_at=clock_timestamp() where id=${quote(first.userId)}`,
        marker: 'proof_binding_fence_changed',
      },
    ] satisfies ScopeChange[]) {
      const beforeGrant = grantHash();
      const beforePublic = publicState();
      let holder: ProofConnection | undefined;
      let pending: ReturnType<typeof issue> | undefined;
      try {
        holder = await new ProofConnection().open();
        holder.send(`select 1 from kaq_private.account_intents where id=${intent} for update;
          ${change.statement}; select '${change.marker}';`);
        await holder.wait(change.marker);
        pending = issue();
        await holder.blocked();
        await holder.finish(true);
        holder = undefined;
        const result = await pending;
        pending = undefined;
        expect(result.ok, change.label).toBe(false);
        expect(result.status, change.label).toBe(401);
        expect(JSON.stringify(result.value), change.label).toContain('KAQ_REAUTHENTICATION_REQUIRED');
        expect(grantHash(), `${change.label}: grant/binding`).toBe(beforeGrant);
        expect(publicState(), `${change.label}: public`).toEqual(beforePublic);
        expect(
          sql(
            `select count(*) from kaq_private.account_committed_proof_bindings where proof_id=${proof}`,
          ),
        ).toBe('0');
        await assertRejected(`${change.label}: stable scope replay`);
      } finally {
        await holder?.abort();
        await pending?.catch(() => undefined);
      }
    }
  });
}
