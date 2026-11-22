import { sql } from './commands';
import { type GrantActor, quote } from './session-grants-fixture';

export type GrantProofSeed = { intent: string; receipt: string; source: string; target: string };
type GrantProofSeedOptions = { binding?: boolean };

export function seedCommittedGrantProofs(
  first: GrantActor,
  second: GrantActor,
  { binding = true }: GrantProofSeedOptions = {},
): GrantProofSeed {
  const a = quote(first.userId);
  const b = quote(second.userId);
  const sidA = quote(first.sessionId);
  const sidB = quote(second.sessionId);
  // commit本体の代替ではなく、実OAuth SID、proof消費、receipt、scope、bindingを一つのTXで置く。
  const result = JSON.parse(
    sql(`begin;
      create temporary table grant_proof_seed_result(intent uuid,receipt uuid,source uuid,target uuid) on commit drop;
      do $seed$ declare seed_intent_id uuid; seed_receipt_id uuid; source_leg_id uuid; target_leg_id uuid;
        source_proof_id uuid; target_proof_id uuid; begin
        insert into kaq_private.account_intents(kind,actor_uid,actor_session_id,secret_hash,state,
          source_account_id,source_membership_epoch,target_uid,target_account_id,target_membership_epoch,expires_at)
        values('merge_existing',${a},${sidA},decode(repeat('00',32),'hex'),'committed',${a},0,${b},${b},0,
          clock_timestamp()+interval '5 minutes') returning id into seed_intent_id;
        insert into kaq_private.account_proof_legs(
          intent_id,side,attempt,state,storage_key,ingest_nonce_hash,expires_at
        )
        values(seed_intent_id,'source',1,'proved','grant-fixture-'||seed_intent_id||'-source',
          decode(repeat('00',32),'hex'),clock_timestamp()+interval '2 minutes')
        returning id into source_leg_id;
        insert into kaq_private.account_proof_legs(
          intent_id,side,attempt,state,storage_key,ingest_nonce_hash,expires_at
        )
        values(seed_intent_id,'target',1,'proved','grant-fixture-'||seed_intent_id||'-target',
          decode(repeat('00',32),'hex'),clock_timestamp()+interval '2 minutes')
        returning id into target_leg_id;
        insert into kaq_private.account_proofs(intent_id,leg_id,auth_uid,session_id,session_created_at,oauth_at,
          account_id,membership_epoch,account_membership_revision,expires_at,consumed_at)
        select seed_intent_id,source_leg_id,s.user_id,s.id,s.created_at,amr.updated_at,s.user_id,0,0,
          clock_timestamp()+interval '2 minutes',clock_timestamp()
        from auth.sessions s join auth.mfa_amr_claims amr on amr.session_id=s.id and amr.authentication_method='oauth'
        where s.id=${sidA}::uuid returning id into source_proof_id;
        insert into kaq_private.account_proofs(intent_id,leg_id,auth_uid,session_id,session_created_at,oauth_at,
          account_id,membership_epoch,account_membership_revision,expires_at,consumed_at)
        select seed_intent_id,target_leg_id,s.user_id,s.id,s.created_at,amr.updated_at,s.user_id,0,0,
          clock_timestamp()+interval '2 minutes',clock_timestamp()
        from auth.sessions s join auth.mfa_amr_claims amr on amr.session_id=s.id and amr.authentication_method='oauth'
        where s.id=${sidB}::uuid returning id into target_proof_id;
        insert into kaq_private.account_merge_receipts(intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
        values(seed_intent_id,${a},1,decode(repeat('00',32),'hex'),'[]','{}','{}') returning id into seed_receipt_id;
        update kaq_private.learning_memberships set account_id=${a},epoch=1,session_fence_at=clock_timestamp()
          where auth_user_id in (${a},${b});
        update kaq_private.learning_accounts set membership_revision=1,session_fence_at=clock_timestamp() where id=${a};
        ${
          binding
            ? `insert into kaq_private.account_committed_proof_bindings(
          proof_id,receipt_id,intent_id,auth_user_id,session_id,canonical_account_id,membership_epoch,account_fence_at,membership_fence_at)
          select p.id,seed_receipt_id,seed_intent_id,p.auth_uid,p.session_id,m.account_id,m.epoch,a.session_fence_at,m.session_fence_at
          from kaq_private.account_proofs p join kaq_private.learning_memberships m on m.auth_user_id=p.auth_uid
          join kaq_private.learning_accounts a on a.id=m.account_id where p.id in (source_proof_id,target_proof_id);`
            : ''
        }
        insert into grant_proof_seed_result values(seed_intent_id,seed_receipt_id,source_proof_id,target_proof_id);
      end $seed$;
      select json_build_object('intent',intent,'receipt',receipt,'source',source,'target',target) from grant_proof_seed_result;
      commit;`)
      .split('\n')
      .find((line) => line.startsWith('{')) ?? 'null',
  ) as GrantProofSeed;
  return result;
}

export function rejectedGrantSql(statement: string, expectedCode: string) {
  sql(`do $grant_test$ begin
    begin
      ${statement};
      raise exception using errcode='P0001',message='Expected grant rejection did not occur';
    exception when sqlstate '${expectedCode}' then null;
    end;
  end $grant_test$;`);
}
