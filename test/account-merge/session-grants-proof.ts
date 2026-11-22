import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';
import { proofGrantConstraints } from './session-grants-proof-constraints';
import { seedCommittedGrantProofs } from './session-grants-proof-seed';
import { artifacts } from './settings';

export function proofGrantCases(get: () => GrantFixture) {
  test('committed proof grants require exact bindings and remain revocable without normal fallback', async () => {
    const [first, second] = get().actors;
    expect(
      sql(`select count(*) from kaq_private.learning_session_grants
      where auth_user_id in (${quote(first.userId)},${quote(second.userId)})`),
    ).toBe('0');
    const ids = seedCommittedGrantProofs(first, second);
    const a = quote(first.userId);
    const source = quote(ids.source);
    const intent = quote(ids.intent);
    const checks: string[] = [];
    const issue = (actor = first, proof = ids.source, receiptId = ids.receipt) =>
      grantRpc(actor, 'issue_learning_session_grant', {
        p_reason: 'proof',
        p_proof_id: proof,
        p_receipt_id: receiptId,
      });
    const rejected = async (label: string, operation: () => ReturnType<typeof issue>) => {
      const before = grantHash();
      const result = await operation();
      expect(result.ok, label).toBe(false);
      expect([400, 401, 403, 409], label).toContain(result.status);
      expect(grantHash(), `${label}: no grant/binding mutation`).toBe(before);
      checks.push(label);
    };
    for (const [actor, proof] of [
      [first, ids.source],
      [second, ids.target],
    ] as const) {
      expect((await issue(actor, proof)).ok).toBe(true);
      const before = grantHash();
      expect((await issue(actor, proof)).ok).toBe(true);
      expect(grantHash()).toBe(before);
      expect((await grantRpc(actor, 'resolve_current_learning_grant')).ok).toBe(true);
    }
    checks.push('two real OAuth proof SIDs', 'same request idempotent', 'two current resolvers');
    await rejected('normal cannot replace a pre-fence proof', () =>
      grantRpc(first, 'issue_learning_session_grant', { p_reason: 'reauthenticated' }),
    );
    await rejected('other UID and SID proof', () => issue(first, ids.target));
    await rejected('unknown proof', () => issue(first, '00000000-0000-4000-8000-000000000001'));
    await rejected('unknown receipt', () =>
      issue(first, ids.source, '00000000-0000-4000-8000-000000000002'),
    );
    const consumed = quote(
      JSON.parse(
        sql(`select to_json(consumed_at) from kaq_private.account_proofs where id=${source}`),
      ) as string,
    );
    const changes = [
      [
        'unconsumed',
        `update kaq_private.account_proofs set consumed_at=null where id=${source}`,
        `update kaq_private.account_proofs set consumed_at=${consumed} where id=${source}`,
      ],
      [
        'cancelled',
        `update kaq_private.account_intents set state='cancelled' where id=${intent}`,
        `update kaq_private.account_intents set state='committed' where id=${intent}`,
      ],
      [
        'expired intent',
        `update kaq_private.account_intents set state='expired' where id=${intent}`,
        `update kaq_private.account_intents set state='committed' where id=${intent}`,
      ],
      [
        'current epoch',
        `update kaq_private.learning_memberships set epoch=2 where auth_user_id=${a}`,
        `update kaq_private.learning_memberships set epoch=1 where auth_user_id=${a}`,
      ],
      [
        'disabled member',
        `update kaq_private.learning_memberships set status='disabled' where auth_user_id=${a}`,
        `update kaq_private.learning_memberships set status='active' where auth_user_id=${a}`,
      ],
      [
        'retired account',
        `update kaq_private.learning_accounts set status='retired',retired_at=clock_timestamp() where id=${a}`,
        `update kaq_private.learning_accounts set status='active',retired_at=null where id=${a}`,
      ],
      ...(['account', 'membership'] as const).flatMap((kind) => {
        const table = kind === 'account' ? 'learning_accounts' : 'learning_memberships';
        const predicate = kind === 'account' ? `id=${a}` : `auth_user_id=${a}`;
        const original = quote(
          JSON.parse(
            sql(`select to_json(session_fence_at) from kaq_private.${table} where ${predicate}`),
          ) as string,
        );
        return ['clock_timestamp()', "'-infinity'::timestamptz", "'infinity'::timestamptz"].map(
          (value) => [
            `${kind} fence ${value}`,
            `update kaq_private.${table} set session_fence_at=${value} where ${predicate}`,
            `update kaq_private.${table} set session_fence_at=${original} where ${predicate}`,
          ],
        );
      }),
    ];
    for (const [label, change, restore] of changes) {
      sql(change);
      try {
        await rejected(`${label} resolver`, () => grantRpc(first, 'resolve_current_learning_grant'));
        await rejected(`${label} issuer`, () => issue());
      } finally {
        sql(restore);
      }
    }
    proofGrantConstraints(first, second, ids, checks);
    writeFileSync(
      `${artifacts}/session-grants-proof.json`,
      JSON.stringify(
        {
          status: 'passed',
          checks,
          syntheticCommittedRecords: true,
          actualOidcIssuers: 2,
          fullMergeImplemented: false,
        },
        null,
        2,
      ),
    );
  });
}
