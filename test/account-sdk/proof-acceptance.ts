import type { ProofAcceptanceCommand } from '../../supabase/functions/account-linking/server/proof-worker.types.ts';
import { gatewayOrigin, testKey } from '../account-merge/settings';

type ProofReceipt = {
  intent_id: string;
  leg_id: string;
  side: 'source' | 'target';
  intent_state: string;
  intent_revision: number;
  leg_revision: number;
  leg_state: 'proved';
  expires_at: number;
  proof_id: string;
};

export class FixtureProofError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = 'fixture proof acceptance rejected',
  ) {
    super(message);
  }
}

function receipt(value: unknown): value is ProofReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).length === 9 &&
    Object.keys(item).every((key) =>
      [
        'intent_id',
        'leg_id',
        'side',
        'intent_state',
        'intent_revision',
        'leg_revision',
        'leg_state',
        'expires_at',
        'proof_id',
      ].includes(key),
    ) &&
    typeof item.intent_id === 'string' &&
    typeof item.leg_id === 'string' &&
    (item.side === 'source' || item.side === 'target') &&
    typeof item.intent_state === 'string' &&
    Number.isSafeInteger(item.intent_revision) &&
    Number.isSafeInteger(item.leg_revision) &&
    item.leg_state === 'proved' &&
    Number.isSafeInteger(item.expires_at) &&
    typeof item.proof_id === 'string'
  );
}

function rejectionCode(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'HTTP_REJECTED';
  const code = (value as Record<string, unknown>).code;
  return typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code : 'HTTP_REJECTED';
}

function rejectionMessage(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return 'fixture proof acceptance rejected';
  const message = (value as Record<string, unknown>).message;
  return typeof message === 'string' ? message : 'fixture proof acceptance rejected';
}

export async function acceptProof(command: ProofAcceptanceCommand, fetcher: typeof fetch) {
  const response = await fetcher(`${gatewayOrigin}/rest/v1/rpc/fixture_accept_account_proof`, {
    method: 'POST',
    headers: {
      apikey: testKey(),
      Authorization: `Bearer ${command.proofJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_intent_id: command.intentId,
      p_leg_id: command.legId,
      p_ingest_nonce: `\\x${command.ingestNonce}`,
      p_expected_leg_revision: command.expectedLegRevision,
    }),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new FixtureProofError(response.status, rejectionCode(value), rejectionMessage(value));
  if (
    !receipt(value) ||
    value.intent_id !== command.intentId ||
    value.leg_id !== command.legId ||
    value.leg_revision < command.expectedLegRevision
  )
    throw new Error('invalid proof acceptance receipt');
}
