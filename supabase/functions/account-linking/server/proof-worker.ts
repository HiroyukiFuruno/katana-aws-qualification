import type {
  ProofAcceptanceLeg,
  ServerProofResult,
  ServerProofWorkerOptions,
} from './proof-worker.types.ts';
import {
  canAccept,
  matchesCommittedProof,
  type ProofIdentity,
  result,
  sameLeg,
  validSessionId,
  verifiedUser,
} from './proof-worker-internal.ts';
import { stored } from './sdk-worker-internal.ts';

export type {
  ProofAcceptanceCommand,
  ProofAcceptanceControl,
  ProofAcceptanceLeg,
  ProofAuth,
  ServerProofResult,
  ServerProofWorkerOptions,
} from './proof-worker.types.ts';

export class ServerProofWorker<Request> {
  constructor(private readonly options: ServerProofWorkerOptions<Request>) {}

  private async identity(
    original: ProofAcceptanceLeg,
    accessToken: string,
    sessionUserId: string,
  ): Promise<ProofIdentity | null> {
    const auth = this.options.auth(original);
    const verified = await auth.getUser(accessToken);
    const sessionId = auth.sessionId(accessToken);
    if (
      verified.error ||
      !verifiedUser(verified.data.user?.id, sessionUserId, original.expectedAuthUid) ||
      !validSessionId(sessionId)
    )
      return null;
    return { authUid: sessionUserId, sessionId };
  }

  private async storedIdentity(original: ProofAcceptanceLeg): Promise<ProofIdentity | null> {
    const session = await stored(this.options.storage(original), original.runtime.storageKey);
    return session ? this.identity(original, session.access_token, session.user.id) : null;
  }

  private async clearCommittedNonce(
    request: Request,
    original: ProofAcceptanceLeg,
    identity?: ProofIdentity,
  ): Promise<void> {
    try {
      const storage = this.options.storage(original);
      await storage.getIngestNonce(original.nonceHash);
      if (!identity) {
        const session = await stored(storage, original.runtime.storageKey);
        if (!session) return;
        identity = (await this.identity(original, session.access_token, session.user.id)) ?? undefined;
        if (!identity) return;
      }
      const committed = await this.options.control.loadCanonical(request);
      if (!sameLeg(original, committed) || !matchesCommittedProof(committed, identity)) return;
      await storage.clearIngestNonce(original.nonceHash);
    } catch {
      // DB受理後のcleanup失敗は、同一proofを再受理せず次回のproved再送で収束させる。
    }
  }

  async accept(request: Request): Promise<ServerProofResult> {
    let original: ProofAcceptanceLeg | undefined;
    try {
      original = await this.options.control.loadCanonical(request);
      if (original.state === 'proved') {
        const identity = await this.storedIdentity(original);
        if (!identity || !matchesCommittedProof(original, identity))
          return result(original, 'runtime_failed');
        await this.clearCommittedNonce(request, original, identity);
        return result(original);
      }
      if (!canAccept(original)) return result(original, 'runtime_failed');

      const storage = this.options.storage(original);
      const [ingestNonce, session] = await Promise.all([
        storage.getIngestNonce(original.nonceHash),
        stored(storage, original.runtime.storageKey),
      ]);
      if (!session) return result(original, 'proof_failed');

      const identity = await this.identity(original, session.access_token, session.user.id);
      if (!identity) return result(original, 'proof_failed');

      await this.options.control.accept({
        intentId: original.runtime.intentId,
        legId: original.id,
        ingestNonce,
        expectedLegRevision: original.revision,
        proofJwt: session.access_token,
      });
      const committed = await this.options.control.loadCanonical(request);
      if (!sameLeg(original, committed) || !matchesCommittedProof(committed, identity))
        return result(original, 'runtime_failed');
      await this.clearCommittedNonce(request, original, identity);
      return result(committed);
    } catch {
      return original
        ? result(original, 'runtime_failed')
        : {
            intentId: '',
            legId: '',
            state: 'failed',
            expiresAt: 0,
            failure: 'runtime_failed',
          };
    }
  }
}
