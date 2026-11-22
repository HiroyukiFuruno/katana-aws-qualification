import { sql } from './commands';
import { type GrantActor, quote } from './session-grants-fixture';

export type GrantProofSeed = { intent: string; receipt: string; source: string; target: string };

export function seedCommittedGrantProofs(first: GrantActor, second: GrantActor): GrantProofSeed {
  const a = quote(first.userId);
  const b = quote(second.userId);
  const sidA = quote(first.sessionId);
  const sidB = quote(second.sessionId);
  // commit本体の代替ではなく、検証済み実OAuth SIDに対応する消費済みrecordをcomponent入力として置く。
  const result: GrantProofSeed = JSON.parse(
    sql(`with intent as (
    insert into kaq_private.account_intents(kind,actor_uid,actor_session_id,secret_hash,state,
      source_account_id,source_membership_epoch,target_uid,target_account_id,target_membership_epoch,expires_at)
    values('merge_existing',${a},${sidA},decode(repeat('00',32),'hex'),'committed',${a},0,${b},${b},0,
      clock_timestamp()+interval '5 minutes') returning id
  ), legs as (
    insert into kaq_private.account_proof_legs(intent_id,side,attempt,state,storage_key,ingest_nonce_hash,expires_at)
    select intent.id,side,1,'proved','grant-fixture-'||intent.id||'-'||side,decode(repeat('00',32),'hex'),
      clock_timestamp()+interval '2 minutes' from intent cross join (values('source'),('target')) sides(side)
    returning id,intent_id,side
  ), proofs as (
    insert into kaq_private.account_proofs(intent_id,leg_id,auth_uid,session_id,session_created_at,oauth_at,
      account_id,membership_epoch,account_membership_revision,expires_at,consumed_at)
    select legs.intent_id,legs.id,s.user_id,s.id,s.created_at,amr.updated_at,s.user_id,0,0,
      clock_timestamp()+interval '2 minutes',clock_timestamp()
    from legs join auth.sessions s on s.id=case when legs.side='source' then ${sidA}::uuid else ${sidB}::uuid end
    join auth.mfa_amr_claims amr on amr.session_id=s.id and amr.authentication_method='oauth'
    returning id,intent_id,auth_uid
  ), receipt as (
    insert into kaq_private.account_merge_receipts(intent_id,canonical_account_id,algorithm_version,
      consent_hash,before_scopes,choices,result)
    select id,${a},1,decode(repeat('00',32),'hex'),'[]','{}','{}' from intent returning id
  ) select json_build_object('intent',(select id from intent),'receipt',(select id from receipt),
    'source',(select id from proofs where auth_uid=${a}),'target',(select id from proofs where auth_uid=${b}))`),
  );
  sql(`update kaq_private.learning_memberships set account_id=${a},epoch=1,session_fence_at=clock_timestamp()
    where auth_user_id in (${a},${b});
    update kaq_private.learning_accounts set membership_revision=1,session_fence_at=clock_timestamp() where id=${a};`);
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
