import assert from 'node:assert/strict';
import type { SdkInspection } from './control-inspection';
import { literal, requiredUuid, sql } from './sql';

type ProofReport = Awaited<ReturnType<SdkInspection['proof']>>[number];

function report(proof: ProofReport[], side: 'source' | 'target') {
  const value = proof.find((entry) => entry.side === side);
  assert(value, `Missing ${side} proof report`);
  return value;
}

export function assertMergeExistingProofs(
  proof: Awaited<ReturnType<SdkInspection['proof']>>,
  mainUserId: string,
) {
  const source = report(proof, 'source');
  const target = report(proof, 'target');
  const checks = JSON.parse(
    sql(`select json_build_object(
      'intent_is_merge_existing', intent.kind='merge_existing' and intent.state='both_proved',
      'source_tuple_is_assigned', source.auth_uid=${literal(requiredUuid(mainUserId))}::uuid
        and source.account_id is not null and source.account_id<>source.auth_uid
        and source.membership_epoch is not null and source.account_membership_revision is not null,
      'target_tuple_is_unassigned', target.auth_uid<>${literal(requiredUuid(mainUserId))}::uuid
        and target.account_id is null and target.membership_epoch is null and target.account_membership_revision is null,
      'source_owner_is_active_alias', exists(select 1 from kaq_private.learning_memberships member
        join kaq_private.learning_accounts account on account.id=member.account_id
        where member.auth_user_id=source.auth_uid and member.account_id=source.account_id
          and member.epoch=source.membership_epoch and account.status='active'),
      'target_has_no_ownership', not exists(select 1 from kaq_private.learning_memberships member
        where member.auth_user_id=target.auth_uid)
        and not exists(select 1 from kaq_private.learning_session_grants grant_row
          where grant_row.auth_user_id=target.auth_uid),
      'main_grant_is_seeded_only', (select count(*)=1 from kaq_private.learning_session_grants grant_row
        where grant_row.auth_user_id=${literal(requiredUuid(mainUserId))}::uuid)
        and exists(select 1 from kaq_private.learning_session_grants grant_row
          where grant_row.auth_user_id=${literal(requiredUuid(mainUserId))}::uuid
            and grant_row.session_id=${literal(source.actorSessionId)}::uuid
            and grant_row.account_id=source.account_id and grant_row.membership_epoch=source.membership_epoch),
      'proof_sessions_got_no_grants', not exists(select 1 from kaq_private.learning_session_grants grant_row
        where grant_row.session_id in (${literal(source.sessionId)}::uuid,${literal(target.sessionId)}::uuid))
    ) from kaq_private.account_proofs source
      join kaq_private.account_intents intent on intent.id=source.intent_id
      join kaq_private.account_proofs target on target.intent_id=intent.id and target.leg_id=${literal(target.legId)}::uuid
      where source.leg_id=${literal(source.legId)}::uuid`),
  ) as Record<string, unknown>;
  const names = [
    'intent_is_merge_existing',
    'source_tuple_is_assigned',
    'target_tuple_is_unassigned',
    'source_owner_is_active_alias',
    'target_has_no_ownership',
    'main_grant_is_seeded_only',
    'proof_sessions_got_no_grants',
  ];
  assert.deepEqual(Object.keys(checks).sort(), names.slice().sort());
  for (const name of names) assert.equal(checks[name], true, `merge-existing check failed: ${name}`);
  return { checks: names.sort() };
}
