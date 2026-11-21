import { promoteEnvelope } from '../../supabase/functions/account-linking/runtime/crypto.ts';
import type {
  ServerSdkLeg,
  ServerSdkStatus,
} from '../../supabase/functions/account-linking/server/sdk-worker.types.ts';
import { SdkRepository } from './runtime';
import { material, runtimeJson } from './runtime-codec';
import { type Actor, actorSql, literal, sql } from './sql';

export async function promote(
  actor: Actor,
  leg: ServerSdkLeg,
  revision: number,
): Promise<ServerSdkStatus> {
  const repo = new SdkRepository(actor, leg.runtime);
  const current = await repo.read(leg.id);
  if (!current) throw new Error('runtime receipt is missing');
  const expiresAt = Number.parseInt(
    sql(
      `select kaq_private.runtime_epoch_ms(expires_at) from kaq_private.account_intents where id=${literal(leg.runtime.intentId)}::uuid;`,
    ),
    10,
  );
  if (!Number.isSafeInteger(expiresAt)) throw new Error('invalid proof expiry');
  const proof = { ...leg.runtime, purpose: 'proof' as const, expiresAt };
  const next = await promoteEnvelope(
    globalThis.crypto,
    leg.runtime,
    proof,
    current,
    material,
    current.revision + 1,
    'sdk-test-v1',
    material,
  );
  const saved = actorSql(
    actor,
    `select kaq_private.runtime_promote_proof(${literal(leg.id)}::uuid,${revision},${literal(JSON.stringify(leg.runtime))},${literal(JSON.stringify(proof))},${literal(runtimeJson(next))});`,
  );
  if (saved !== 't') throw new Error('runtime promotion failed');
  return { legId: leg.id, state: 'exchanged', expiresAt };
}
