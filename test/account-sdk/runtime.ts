import { EncryptedPkceStorage } from '../../supabase/functions/account-linking/runtime/pkce-storage.ts';
import type {
  RuntimeContext,
  RuntimeRecord,
  RuntimeRepository,
  RuntimeWriteGuard,
} from '../../supabase/functions/account-linking/runtime/types.ts';
import type { ServerSdkLeg } from '../../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { keyring, record, runtimeJson } from './runtime-codec';
import { runtimeSql } from './runtime-sql';
import { type Actor, literal, requiredUuid } from './sql';

export class SdkRepository implements RuntimeRepository {
  constructor(
    private readonly actor: Actor,
    private readonly context: RuntimeContext,
  ) {}
  async read(legId: string): Promise<RuntimeRecord | null> {
    requiredUuid(legId);
    const value = await runtimeSql(
      this.actor,
      `select coalesce(kaq_private.runtime_read(${literal(legId)}::uuid,${literal(JSON.stringify(this.context))})::text,'null');`,
    );
    return value === 'null' ? null : record(JSON.parse(value) as unknown);
  }
  async readRevisionForCleanup(legId: string, guard: RuntimeWriteGuard): Promise<number | null> {
    requiredUuid(legId);
    const value = await runtimeSql(
      this.actor,
      `select coalesce(kaq_private.runtime_cleanup_revision(${literal(legId)}::uuid,${literal(JSON.stringify(guard))})::text,'');`,
    );
    return value ? Number.parseInt(value, 10) : null;
  }
  async compareAndSwap(
    legId: string,
    revision: number | null,
    next: RuntimeRecord,
    guard: RuntimeWriteGuard,
  ): Promise<boolean> {
    requiredUuid(legId);
    const expected = revision === null ? 'null' : String(revision);
    return (
      (await runtimeSql(
        this.actor,
        `select kaq_private.runtime_compare_and_swap(${literal(legId)}::uuid,${expected},${literal(runtimeJson(next))},${literal(JSON.stringify(guard))});`,
      )) === 't'
    );
  }
  async deleteIfRevision(
    legId: string,
    revision: number | null,
    guard: RuntimeWriteGuard,
  ): Promise<'deleted' | 'missing' | 'conflict'> {
    const expected = revision === null ? 'null' : String(revision);
    const value = await runtimeSql(
      this.actor,
      `select kaq_private.runtime_delete_if_revision(${literal(legId)}::uuid,${expected},${literal(JSON.stringify(guard))});`,
    );
    if (value === 'deleted' || value === 'missing' || value === 'conflict') return value;
    throw new Error('invalid runtime cleanup response');
  }
  async isTerminal(legId: string): Promise<boolean> {
    return (
      (await runtimeSql(
        this.actor,
        `select kaq_private.runtime_is_terminal(${literal(requiredUuid(legId))}::uuid,${literal(JSON.stringify(this.context))});`,
      )) === 't'
    );
  }
}

export function storage(actor: Actor, leg: Pick<ServerSdkLeg, 'runtime'>): EncryptedPkceStorage {
  return new EncryptedPkceStorage({
    repository: new SdkRepository(actor, leg.runtime),
    keyring: keyring(),
    crypto: globalThis.crypto,
    clock: { now: Date.now },
    context: leg.runtime,
  });
}

export { promote } from './runtime-promotion';
