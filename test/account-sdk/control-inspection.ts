import type { ServerSdkLeg } from '../../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { leg, type Operation } from './control-fixture';
import { SdkRepository, storage } from './runtime';
import { literal, requiredUuid, sql } from './sql';

export class SdkInspection {
  private readonly secrets = new Set<string>();
  private providerTokenResponses = 0;

  constructor(private readonly operations: Map<string, Operation>) {}

  readonly fetch: typeof globalThis.fetch = async (input, init) => {
    const response = await globalThis.fetch(input, init);
    if (String(input).includes('/token?grant_type=pkce') && response.ok) {
      const value: unknown = await response.clone().json();
      if (value && typeof value === 'object') {
        const token = value as Record<string, unknown>;
        if (typeof token.provider_token === 'string' && token.provider_token.length > 0) {
          this.providerTokenResponses += 1;
          this.secrets.add(token.provider_token);
        }
        if (typeof token.provider_refresh_token === 'string' && token.provider_refresh_token.length > 0)
          this.secrets.add(token.provider_refresh_token);
      }
    }
    return response;
  };

  async prepared(operation: Operation, current: ServerSdkLeg) {
    const encrypted = storage(operation.actor, current);
    this.secrets.add(await encrypted.getIngestNonce(current.nonceHash));
    const value = await encrypted.getItem(`${current.runtime.storageKey}-code-verifier`);
    if (!value) throw new Error('SDK verifier was not durably prepared');
    const verifier: unknown = JSON.parse(value);
    if (typeof verifier !== 'string' || !verifier) throw new Error('invalid SDK verifier');
    this.secrets.add(verifier.split('/')[0]);
  }

  async proof() {
    return Promise.all(
      [...this.operations.values()].map(async (operation) => {
        const current = leg(operation);
        const raw = await storage(operation.actor, current).getItem(current.runtime.storageKey);
        if (!raw) throw new Error('sealed SDK session is missing');
        const session = JSON.parse(raw) as Record<string, unknown>;
        if (typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string')
          throw new Error('invalid sealed SDK session');
        this.secrets.add(session.access_token);
        this.secrets.add(session.refresh_token);
        const claims = JSON.parse(
          Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'),
        ) as Record<string, unknown>;
        if (typeof claims.sub !== 'string' || typeof claims.session_id !== 'string')
          throw new Error('invalid verified SDK session identifiers');
        requiredUuid(claims.sub);
        requiredUuid(claims.session_id);
        const issued = current.runtime.issuedAt;
        const live = sql(
          `select exists(select 1 from auth.sessions s where s.id=${literal(claims.session_id)}::uuid and s.user_id=${literal(claims.sub)}::uuid and s.created_at>=to_timestamp(${issued}/1000.0) and exists(select 1 from auth.mfa_amr_claims amr where amr.session_id=s.id and amr.authentication_method='oauth' and amr.updated_at>=to_timestamp(${issued}/1000.0)));`,
        );
        if (live !== 't') throw new Error('missing actual SDK OAuth session');
        const record = await new SdkRepository(operation.actor, current.runtime).read(current.id);
        if (!record || record.expiresAt !== current.runtime.expiresAt)
          throw new Error('proof runtime deadline mismatch');
        return {
          legId: current.id,
          side: current.side,
          state: current.state,
          purpose: current.runtime.purpose,
          authUserId: claims.sub,
          sessionId: claims.session_id,
          actorUid: operation.actor.userId,
          actorSessionId: operation.actor.sessionId,
          expiresAt: record.expiresAt,
          providerTokensStripped:
            !Object.hasOwn(session, 'provider_token') &&
            !Object.hasOwn(session, 'provider_refresh_token'),
        };
      }),
    );
  }

  async assertNoBrowserLeak(values: string[]) {
    await this.proof();
    if (this.providerTokenResponses !== 2)
      throw new Error('Require two actual provider-token responses');
    if ([...this.secrets].some((secret) => values.some((value) => value.includes(secret))))
      throw new Error('browser leaked a server SDK secret');
  }
}
