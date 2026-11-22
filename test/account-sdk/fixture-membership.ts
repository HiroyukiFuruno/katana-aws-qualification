import { randomUUID } from 'node:crypto';
import { gatewayOrigin, testKey } from '../account-merge/settings';
import type { IntentKind, SourceScope } from './control-fixture';
import { type Actor, json, literal, requiredUuid, sql } from './sql';

type TargetProof = { side: 'source' | 'target'; proofAuthUid: string };
export type OwnedMembership = { accountIds: Set<string>; aliasUserIds: Set<string> };

async function createOwnerAlias() {
  const token = testKey('service_role');
  const email = `sdk-owner-${randomUUID()}@account-merge.example.test`;
  const response = await fetch(`${gatewayOrigin}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: token, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const value: unknown = await response.json();
  if (!response.ok || !value || typeof value !== 'object')
    throw new Error('owner alias creation failed');
  const user = value as Record<string, unknown>;
  if (user.email !== email || typeof user.id !== 'string') throw new Error('invalid owner alias');
  return requiredUuid(user.id);
}

async function seedMembership(proofUid: string, owned: OwnedMembership, actor?: Actor) {
  requiredUuid(proofUid);
  const existing = sql(
    `select exists(select 1 from kaq_private.learning_memberships where auth_user_id=${literal(proofUid)}::uuid);`,
  );
  if (existing !== 'f') throw new Error('target membership fixture is not isolated');
  const accountId = await createOwnerAlias();
  owned.aliasUserIds.add(accountId);
  if (accountId === proofUid) throw new Error('owner alias must differ from proof user');
  sql(
    `begin;
     insert into kaq_private.learning_accounts(id) values(${literal(accountId)}::uuid);
     insert into kaq_private.learning_memberships(auth_user_id,account_id)
     values(${literal(proofUid)}::uuid,${literal(accountId)}::uuid);
     insert into public.learning_state(user_id) values(${literal(accountId)}::uuid);
     ${
       actor
         ? `insert into kaq_private.learning_session_grants(session_id,auth_user_id,account_id,membership_epoch,reason)
       values(${literal(requiredUuid(actor.sessionId))}::uuid,${literal(proofUid)}::uuid,${literal(accountId)}::uuid,0,'created');`
         : ''
     }
     commit;`,
  );
  owned.accountIds.add(accountId);
}

function sourceScope(actor: Actor): SourceScope | null {
  const value = json<{
    accountId: string;
    membershipEpoch: number;
    accountRevision: number;
    accountStatus: string;
    membershipStatus: string;
  } | null>(`select coalesce((select json_build_object(
    'accountId',member.account_id,'membershipEpoch',member.epoch,'accountRevision',account.membership_revision,
    'accountStatus',account.status,'membershipStatus',member.status)
    from kaq_private.learning_memberships member join kaq_private.learning_accounts account on account.id=member.account_id
    where member.auth_user_id=${literal(actor.userId)}::uuid)::text,'null')`);
  if (value === null) return null;
  requiredUuid(value.accountId);
  if (
    value.accountId === actor.userId ||
    !Number.isSafeInteger(value.membershipEpoch) ||
    !Number.isSafeInteger(value.accountRevision) ||
    value.accountStatus !== 'active' ||
    value.membershipStatus !== 'active'
  )
    throw new Error('invalid merge-existing source membership');
  return value;
}

export async function seedSourceMembership(
  actor: Actor,
  kind: IntentKind,
  owned: OwnedMembership,
): Promise<SourceScope | undefined> {
  if (kind !== 'merge_existing') return;
  const existing = sourceScope(actor);
  if (existing) {
    if (!owned.accountIds.has(existing.accountId))
      throw new Error('Source membership fixture is not isolated');
    return existing;
  }
  await seedMembership(actor.userId, owned, actor);
  const seeded = sourceScope(actor);
  if (!seeded) throw new Error('Source membership fixture was not created');
  return seeded;
}

export async function seedTargetMembership(
  port: TargetProof,
  owned: OwnedMembership,
  kind: IntentKind,
  actorUid: string,
  source: SourceScope | undefined,
  sameOwner: boolean,
  targetExisting: boolean,
) {
  if (port.side !== 'target' || port.proofAuthUid === actorUid) return;
  if (kind === 'merge_existing' && sameOwner) {
    if (!source || !owned.accountIds.has(source.accountId))
      throw new Error('same-owner source scope is not fixture-owned');
    const existing = sql(
      `select exists(select 1 from kaq_private.learning_memberships where auth_user_id=${literal(port.proofAuthUid)}::uuid);`,
    );
    if (existing !== 'f') throw new Error('same-owner target membership fixture is not isolated');
    sql(
      `insert into kaq_private.learning_memberships(auth_user_id,account_id)
       values(${literal(port.proofAuthUid)}::uuid,${literal(source.accountId)}::uuid);`,
    );
    return;
  }
  if (kind !== 'add_existing' && !(kind === 'merge_existing' && targetExisting)) return;
  await seedMembership(port.proofAuthUid, owned);
}
