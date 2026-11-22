import { createHmac } from 'node:crypto';
import type { ProofAcceptanceCommand } from '../../supabase/functions/account-linking/server/proof-worker.types.ts';
import { fixtureJwtSecret } from '../account-merge/settings';
import { FixtureProofError } from './proof-acceptance';

export type ProofBoundaryKind = 'signature' | 'audience' | 'issuer' | 'nonce';
export type ProofBoundaryResult = { status: number; code: string; expiryUnchanged: true };

function modifiedJwt(token: string, kind: Exclude<ProofBoundaryKind, 'nonce'>): string {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid real proof JWT');
  const rawHeader: unknown = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const rawClaims: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (
    !rawHeader ||
    typeof rawHeader !== 'object' ||
    !('alg' in rawHeader) ||
    rawHeader.alg !== 'HS256' ||
    !rawClaims ||
    typeof rawClaims !== 'object' ||
    Array.isArray(rawClaims)
  )
    throw new Error('Unexpected fixture JWT format');
  const claims = rawClaims as Record<string, unknown>;
  const expiry = claims.exp;
  if (typeof expiry !== 'number' || !Number.isSafeInteger(expiry) || expiry - Date.now() / 1000 < 300)
    throw new Error('Require a normal-lifetime real proof JWT');
  if (kind === 'signature') {
    parts[2] = `${parts[2][0] === 'A' ? 'B' : 'A'}${parts[2].slice(1)}`;
    return parts.join('.');
  }
  if (kind === 'audience') claims.aud = 'not-kaq-audience';
  else claims.iss = 'https://foreign-issuer.invalid/auth/v1';
  if (claims.exp !== expiry) throw new Error('Proof expiry must never change');
  const unsigned = `${parts[0]}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}`;
  return `${unsigned}.${createHmac('sha256', fixtureJwtSecret).update(unsigned).digest('base64url')}`;
}

export async function negativeProofRequest(
  command: ProofAcceptanceCommand,
  kind: ProofBoundaryKind,
  accept: (command: ProofAcceptanceCommand) => Promise<void>,
  remember: (value: string) => void,
): Promise<ProofBoundaryResult> {
  const changed = { ...command };
  if (kind === 'nonce')
    changed.ingestNonce = `${command.ingestNonce[0] === 'a' ? 'b' : 'a'}${command.ingestNonce.slice(1)}`;
  else changed.proofJwt = modifiedJwt(command.proofJwt, kind);
  remember(changed.proofJwt);
  remember(changed.ingestNonce);
  try {
    await accept(changed);
  } catch (error) {
    if (error instanceof FixtureProofError)
      return { status: error.status, code: error.code, expiryUnchanged: true };
    throw error;
  }
  throw new Error('A modified proof request was accepted');
}
