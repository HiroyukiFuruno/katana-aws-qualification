import type {
  ProofAcceptanceCommand,
  ProofAcceptanceControl,
  ProofAcceptanceLeg,
} from '../../supabase/functions/account-linking/server/proof-worker.types.ts';
import { SdkExchangeControl } from './control-exchange';
import { leg, type Operation } from './control-fixture';
import { acceptProof } from './proof-acceptance';
import { verifyProofPostconditions } from './proof-postconditions';

export type { Operation } from './control-fixture';

export class SdkControl extends SdkExchangeControl implements ProofAcceptanceControl<Operation> {
  async loadCanonical(operation: Operation): Promise<ProofAcceptanceLeg> {
    return leg(operation);
  }

  async accept(command: ProofAcceptanceCommand): Promise<void> {
    return acceptProof(command, this.inspection.fetch);
  }

  async verifyPostAcceptance() {
    const source = [...this.operations.values()].find(
      (operation) => operation.side === 'source' && operation.intent && operation.legId,
    );
    const target = [...this.operations.values()].find(
      (operation) => operation.side === 'target' && operation.intent && operation.legId,
    );
    if (!source || !target) throw new Error('missing proof operations');
    return verifyProofPostconditions(source, target, await this.inspection.proof());
  }

  proof(options?: { allowRetainedNonce?: boolean }) {
    return this.inspection.proof(options);
  }

  assertNoBrowserLeak(values: string[], expectedProviderResponses: 1 | 2 = 2) {
    return this.inspection.assertNoBrowserLeak(values, expectedProviderResponses);
  }

  rememberSecret(value: string) {
    this.inspection.rememberSecret(value);
  }

  assertNoCodeExchange() {
    return this.inspection.assertNoCodeExchange();
  }

  assertAuthorizationFailurePrivacy(values: string[]) {
    this.inspection.assertCapturedSecrets(values);
  }

  get fetch(): typeof globalThis.fetch {
    return this.inspection.fetch;
  }
}
