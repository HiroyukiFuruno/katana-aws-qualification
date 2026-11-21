import type { ProofAcceptanceLeg, ServerProofResult } from './proof-worker.types.ts';

export type ProofIdentity = { authUid: string; sessionId: string };

export function result(
  leg: ProofAcceptanceLeg,
  failure?: ServerProofResult['failure'],
): ServerProofResult {
  return {
    intentId: leg.runtime.intentId,
    legId: leg.id,
    state: leg.intentState,
    expiresAt: leg.expiresAt,
    ...(failure ? { failure } : {}),
  };
}

export function sameLeg(original: ProofAcceptanceLeg, current: ProofAcceptanceLeg): boolean {
  const fields = ['intentId', 'legId', 'attempt', 'storageKey', 'issuedAt', 'expiresAt'] as const;
  return (
    original.id === current.id &&
    original.side === current.side &&
    original.expectedAuthUid === current.expectedAuthUid &&
    original.runtime.purpose === 'proof' &&
    current.runtime.purpose === 'proof' &&
    fields.every((field) => original.runtime[field] === current.runtime[field])
  );
}

export function canAccept(leg: ProofAcceptanceLeg): boolean {
  return leg.active && leg.state === 'exchanged' && leg.runtime.purpose === 'proof';
}

export function matchesCommittedProof(leg: ProofAcceptanceLeg, identity: ProofIdentity): boolean {
  return (
    leg.state === 'proved' &&
    leg.provedAuthUid === identity.authUid &&
    leg.provedSessionId === identity.sessionId
  );
}

export function verifiedUser(
  userId: string | undefined,
  sessionUserId: string,
  expectedAuthUid: string | undefined,
): boolean {
  return (
    typeof userId === 'string' &&
    userId === sessionUserId &&
    (expectedAuthUid === undefined || userId === expectedAuthUid)
  );
}

export function validSessionId(value: string | null): value is string {
  return (
    value !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
