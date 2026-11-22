import { expect } from '@playwright/test';
import { type GrantActor, grantHash, quote } from './session-grants-fixture';
import { type GrantProofSeed, rejectedGrantSql } from './session-grants-proof-seed';

export function proofGrantConstraints(
  first: GrantActor,
  second: GrantActor,
  ids: GrantProofSeed,
  checks: string[],
) {
  const source = quote(ids.source);
  const target = quote(ids.target);
  const receipt = quote(ids.receipt);
  const b = quote(second.userId);
  const statements = [
    [
      'bare proof CHECK',
      `update kaq_private.learning_session_grants set proof_id=null where session_id=${quote(first.sessionId)}`,
      '23514',
    ],
    [
      'normal proof-id CHECK',
      `update kaq_private.learning_session_grants set reason='reauthenticated' where session_id=${quote(first.sessionId)}`,
      '23514',
    ],
    [
      'grant composite binding FK',
      `update kaq_private.learning_session_grants set proof_id=${target} where session_id=${quote(first.sessionId)}`,
      '23503',
    ],
    [
      'proof immutable binding FK',
      `update kaq_private.account_proofs set session_id=${quote(second.sessionId)} where id=${source}`,
      '23505',
    ],
    [
      'receipt canonical FK',
      `update kaq_private.account_merge_receipts set canonical_account_id=${b} where id=${receipt}`,
      '23503',
    ],
    [
      'binding epoch trigger',
      `update kaq_private.account_committed_proof_bindings set membership_epoch=2 where proof_id=${source}`,
      'PT401',
    ],
    [
      'binding receipt trigger',
      `update kaq_private.account_committed_proof_bindings set receipt_id='00000000-0000-4000-8000-000000000002' where proof_id=${source}`,
      'PT401',
    ],
    [
      'binding session trigger',
      `update kaq_private.account_committed_proof_bindings set session_id=${quote(second.sessionId)} where proof_id=${source}`,
      '28000',
    ],
    [
      'binding fence trigger',
      `update kaq_private.account_committed_proof_bindings set account_fence_at=null where proof_id=${source}`,
      'PT401',
    ],
    ...['anon', 'authenticated', 'service_role'].map((role) => [
      `${role} direct binding DML`,
      `set local role ${role}; delete from kaq_private.account_committed_proof_bindings where proof_id=${source}`,
      '42501',
    ]),
  ];
  for (const [label, statement, code] of statements) {
    const before = grantHash();
    rejectedGrantSql(statement, code);
    expect(grantHash(), label).toBe(before);
    checks.push(label);
  }
}
