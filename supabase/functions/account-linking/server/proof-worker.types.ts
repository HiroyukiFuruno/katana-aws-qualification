import type { EncryptedPkceStorage } from '../runtime/pkce-storage.ts';
import type { RuntimeContext } from '../runtime/types.ts';

export type ProofAcceptanceLeg = {
  id: string;
  revision: number;
  state: string;
  intentState: string;
  expiresAt: number;
  runtime: RuntimeContext;
  nonceHash: Uint8Array;
  side: 'source' | 'target';
  active: boolean;
  expectedAuthUid?: string;
  provedAuthUid?: string;
  provedSessionId?: string;
};

export type ProofAcceptanceCommand = {
  intentId: string;
  legId: string;
  ingestNonce: string;
  expectedLegRevision: number;
  proofJwt: string;
};

export type ProofAcceptanceControl<Request> = {
  /** main session/intent secretを検証した正規recordだけを返す。 */
  loadCanonical(request: Request): Promise<ProofAcceptanceLeg>;
  /** proofJwtは認証済みPostgREST Bearerだけに使い、UID/SIDはSQLが導出する。 */
  accept(command: ProofAcceptanceCommand): Promise<void>;
};

export type ProofAuth = {
  getUser(accessToken: string): Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  sessionId(accessToken: string): string | null;
};

export type ServerProofWorkerOptions<Request> = {
  control: ProofAcceptanceControl<Request>;
  storage(leg: ProofAcceptanceLeg): EncryptedPkceStorage;
  auth(leg: ProofAcceptanceLeg): ProofAuth;
};

export type ServerProofResult = {
  intentId: string;
  legId: string;
  state: string;
  expiresAt: number;
  failure?: 'proof_failed' | 'runtime_failed';
};
