import { expect, test } from 'bun:test';
import { acceptProof } from '../proof-acceptance';

const command = {
  intentId: '11111111-1111-4111-8111-111111111111',
  legId: '22222222-2222-4222-8222-222222222222',
  ingestNonce: 'ab'.repeat(32),
  expectedLegRevision: 1,
  proofJwt: 'fixture-proof-jwt',
};

function receipt(extra: Record<string, unknown> = {}) {
  return {
    intent_id: command.intentId,
    intent_state: 'already_linked',
    intent_revision: 3,
    leg_id: command.legId,
    leg_state: 'proved',
    leg_revision: 2,
    side: 'target',
    expires_at: 1_700_000_000_000,
    proof_id: '33333333-3333-4333-8333-333333333333',
    ...extra,
  };
}

test('already-linked receipt permits only an opaque terminal receipt identifier', async () => {
  await expect(
    acceptProof(
      command,
      async () =>
        new Response(
          JSON.stringify(receipt({ commit_receipt_id: '44444444-4444-4444-8444-444444444444' })),
        ),
    ),
  ).resolves.toBeUndefined();
  await expect(
    acceptProof(
      command,
      async () => new Response(JSON.stringify(receipt({ secret: 'must-not-escape' }))),
    ),
  ).rejects.toThrow('invalid proof acceptance receipt');
});
