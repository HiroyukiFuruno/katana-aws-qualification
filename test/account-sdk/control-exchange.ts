import { randomUUID } from 'node:crypto';
import type {
  ServerSdkControl,
  ServerSdkLeg,
  ServerSdkStatus,
} from '../../supabase/functions/account-linking/server/sdk-worker.types.ts';
import {
  type AuthorizationFailure,
  injectRuntimeRevisionOverflow,
  verifyAuthorizationFailure,
} from './authorization-failure';
import { hex, leg, type Operation, reply, sourceIntent, targetIntent } from './control-fixture';
import { SdkInspection } from './control-inspection';
import { promote, SdkRepository } from './runtime';
import { literal } from './sql';

export class SdkExchangeControl implements ServerSdkControl<Operation> {
  protected readonly inspection: SdkInspection;

  constructor(
    protected readonly operations: Map<string, Operation>,
    inspection: SdkInspection | undefined,
    private readonly injectAuthorizationFailure = false,
  ) {
    this.inspection = inspection ?? new SdkInspection(operations);
  }

  async openAuthorization(operation: Operation, nonceHash: Uint8Array): Promise<ServerSdkLeg> {
    if (operation.legId) return leg(operation);
    operation.intent =
      operation.side === 'source'
        ? sourceIntent(operation.actor, operation.kind, operation.sourceScope)
        : targetIntent(operation.actor, this.operations);
    const issued = reply(
      operation.actor,
      `select kaq_private.issue_account_leg(${literal(operation.intent.id)}::uuid,${literal(operation.intent.secret)},${literal(operation.side)},${operation.intent.version},${literal(randomUUID())}::uuid,decode(${literal(hex(nonceHash))},'hex'))::text;`,
    );
    if (!issued.leg_id || issued.leg_state !== 'issued') throw new Error('SDK leg issue failed');
    operation.legId = issued.leg_id;
    operation.nonceHash = nonceHash;
    this.operations.set(issued.leg_id, operation);
    return leg(operation);
  }

  async reloadAuthorization(operation: Operation): Promise<ServerSdkLeg> {
    return leg(operation);
  }

  async claimAuthorization(current: ServerSdkLeg): Promise<{ claimed: boolean; claimId?: string }> {
    const operation = this.operation(current.id);
    const runtime = await this.runtime(current);
    const intent = this.intent(operation);
    const value = reply(
      operation.actor,
      `select kaq_private.claim_authorization(${literal(intent.id)}::uuid,${literal(intent.secret)},${literal(current.id)}::uuid,${current.revision},${runtime.revision},decode(${literal(hex(current.nonceHash))},'hex'))::text;`,
    );
    if (value.claim_id) operation.claimId = value.claim_id;
    if (value.claimed === true && value.claim_id && this.injectAuthorizationFailure) {
      await this.inspection.captureAuthorizationNonce(operation, current);
      injectRuntimeRevisionOverflow(current.id);
    }
    return { claimed: value.claimed === true, ...(value.claim_id ? { claimId: value.claim_id } : {}) };
  }

  async completeAuthorization(current: ServerSdkLeg, claimId: string): Promise<ServerSdkLeg> {
    const operation = this.operation(current.id);
    await this.inspection.prepared(operation, current);
    const runtime = await this.runtime(current);
    const intent = this.intent(operation);
    reply(
      operation.actor,
      `select kaq_private.complete_authorization(${literal(intent.id)}::uuid,${literal(intent.secret)},${literal(current.id)}::uuid,${literal(claimId)}::uuid,${current.revision},${runtime.revision})::text;`,
    );
    return leg(operation);
  }

  async failAuthorization(current: ServerSdkLeg, claimId: string): Promise<ServerSdkStatus> {
    return this.fail(current, claimId, false);
  }

  async loadExchange(operation: Operation): Promise<ServerSdkLeg> {
    return leg(operation);
  }

  async claimExchange(current: ServerSdkLeg): Promise<{ claimed: boolean; leg: ServerSdkLeg }> {
    const operation = this.operation(current.id);
    const intent = this.intent(operation);
    const value = reply(
      operation.actor,
      `select kaq_private.claim_exchange(${literal(intent.id)}::uuid,${literal(intent.secret)},${literal(current.id)}::uuid,${current.revision})::text;`,
    );
    return { claimed: value.claimed === true, leg: leg(operation) };
  }

  async promote(current: ServerSdkLeg): Promise<ServerSdkStatus> {
    return promote(this.operation(current.id).actor, current, current.revision);
  }

  async failExchange(current: ServerSdkLeg, unknown: boolean): Promise<ServerSdkStatus> {
    return this.fail(current, this.operation(current.id).claimId, unknown);
  }

  verifyAuthorizationFailure(): AuthorizationFailure {
    return verifyAuthorizationFailure(this.operations);
  }

  private operation(legId: string) {
    const value = this.operations.get(legId);
    if (!value) throw new Error('unknown SDK operation');
    return value;
  }

  private intent(operation: Operation) {
    if (!operation.intent) throw new Error('unknown SDK intent');
    return operation.intent;
  }

  private async runtime(current: ServerSdkLeg) {
    const value = await new SdkRepository(this.operation(current.id).actor, current.runtime).read(
      current.id,
    );
    if (!value) throw new Error('missing runtime');
    return value;
  }

  private async fail(
    current: ServerSdkLeg,
    claimId: string | undefined,
    unknown: boolean,
  ): Promise<ServerSdkStatus> {
    if (!claimId) throw new Error('missing authorization claim');
    const operation = this.operation(current.id);
    const intent = this.intent(operation);
    reply(
      operation.actor,
      `select kaq_private.fail_leg(${literal(intent.id)}::uuid,${literal(intent.secret)},${literal(current.id)}::uuid,${literal(claimId)}::uuid,${current.revision},${unknown})::text;`,
    );
    const latest = leg(operation);
    return { legId: latest.id, state: latest.state, expiresAt: latest.expiresAt };
  }
}
