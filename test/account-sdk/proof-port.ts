import { AuthClient } from '@supabase/auth-js';
import {
  type ProofAcceptanceLeg,
  ServerProofWorker,
} from '../../supabase/functions/account-linking/server/proof-worker.ts';
import type { ProofAcceptanceCommand } from '../../supabase/functions/account-linking/server/proof-worker.types.ts';
import { gatewayOrigin, testKey } from '../account-merge/settings';
import type { Operation, SdkControl } from './control';
import {
  negativeProofRequest,
  type ProofBoundaryKind,
  type ProofBoundaryResult,
} from './proof-token-negative';
import { storage } from './runtime';
import { requiredUuid } from './sql';

export type ProofRacePort = {
  intentId: string;
  legId: string;
  side: 'source' | 'target';
  proofAuthUid: string;
  proofSessionId: string;
  accept(): Promise<void>;
  acceptReuse(command: Omit<ProofAcceptanceCommand, 'proofJwt'>): Promise<void>;
  rejectModified(kind: ProofBoundaryKind): Promise<ProofBoundaryResult>;
};

function proofIdentity(accessToken: string) {
  const claims: unknown = JSON.parse(
    Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8'),
  );
  if (!claims || typeof claims !== 'object') throw new Error('invalid sealed proof session');
  const identity = claims as Record<string, unknown>;
  if (typeof identity.sub !== 'string' || typeof identity.session_id !== 'string')
    throw new Error('invalid sealed proof session');
  return { authUid: requiredUuid(identity.sub), sessionId: requiredUuid(identity.session_id) };
}

export function proofWorker(control: SdkControl, operations: Map<string, Operation>) {
  return new ServerProofWorker({
    control,
    storage: (leg) => {
      const operation = operations.get(leg.id);
      if (!operation) throw new Error('unknown SDK operation');
      return storage(operation.actor, leg);
    },
    auth: () => {
      const auth = new AuthClient({
        url: `${gatewayOrigin}/auth/v1`,
        headers: { apikey: testKey() },
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        skipAutoInitialize: true,
        fetch: control.fetch,
      });
      return {
        getUser: (accessToken: string) => auth.getUser(accessToken),
        sessionId: (accessToken: string) => {
          try {
            return proofIdentity(accessToken).sessionId;
          } catch {
            return null;
          }
        },
      };
    },
  });
}

export async function proofRacePort(
  operation: Operation,
  leg: ProofAcceptanceLeg,
  control: SdkControl,
): Promise<ProofRacePort> {
  const sealed = await storage(operation.actor, leg).getItem(leg.runtime.storageKey);
  if (!sealed) throw new Error('sealed proof session is missing');
  const session: unknown = JSON.parse(sealed);
  if (!session || typeof session !== 'object') throw new Error('invalid sealed proof session');
  const accessToken = (session as Record<string, unknown>).access_token;
  if (typeof accessToken !== 'string') throw new Error('invalid sealed proof session');
  const ingestNonce = await storage(operation.actor, leg).getIngestNonce(leg.nonceHash);
  const command = {
    intentId: leg.runtime.intentId,
    legId: leg.id,
    ingestNonce,
    expectedLegRevision: leg.revision,
    proofJwt: accessToken,
  };
  return {
    intentId: leg.runtime.intentId,
    legId: leg.id,
    side: leg.side,
    proofAuthUid: proofIdentity(accessToken).authUid,
    proofSessionId: proofIdentity(accessToken).sessionId,
    accept: () => control.accept(command),
    acceptReuse: (reuse) => control.accept({ ...reuse, proofJwt: accessToken }),
    rejectModified: (kind) =>
      negativeProofRequest(
        command,
        kind,
        (value) => control.accept(value),
        (value) => control.rememberSecret(value),
      ),
  };
}
