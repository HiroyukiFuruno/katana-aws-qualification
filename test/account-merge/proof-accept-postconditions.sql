-- fixtureが実OAuthの両proofを受理し同一wrapper入力を再送した後だけ実行する。runnerがUUIDを置換する。
begin;
create temporary table proof_accept_post_checks(name text primary key) on commit drop;
create function pg_temp.proof_accept_post_assert(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'proof accept postcondition failed: %', label; end if;
  insert into proof_accept_post_checks values(label);
end $$;
do $$
declare
  v_intent_id uuid := '__INTENT_ID__'; v_source_leg uuid := '__SOURCE_LEG__'; v_target_leg uuid := '__TARGET_LEG__';
  v_source_uid uuid := '__SOURCE_UID__'; v_target_uid uuid := '__TARGET_UID__';
  source_proof kaq_private.account_proofs%rowtype; target_proof kaq_private.account_proofs%rowtype;
  intent kaq_private.account_intents%rowtype; source_leg_row kaq_private.account_proof_legs%rowtype;
  target_leg_row kaq_private.account_proof_legs%rowtype; source_account kaq_private.learning_accounts%rowtype;
begin
  select * into strict intent from kaq_private.account_intents i where i.id = v_intent_id;
  select * into strict source_proof from kaq_private.account_proofs p where p.intent_id = v_intent_id and p.leg_id = v_source_leg;
  select * into strict target_proof from kaq_private.account_proofs p where p.intent_id = v_intent_id and p.leg_id = v_target_leg;
  select * into strict source_leg_row from kaq_private.account_proof_legs l where l.id = v_source_leg;
  select * into strict target_leg_row from kaq_private.account_proof_legs l where l.id = v_target_leg;
  select * into source_account from kaq_private.learning_accounts where id = source_proof.account_id;
  perform pg_temp.proof_accept_post_assert('two_proofs_exactly_once',
    (select count(*) = 2 from kaq_private.account_proofs p where p.intent_id = v_intent_id));
  perform pg_temp.proof_accept_post_assert('source_target_identity_bound',
    source_proof.auth_uid = v_source_uid and target_proof.auth_uid = v_target_uid and v_source_uid <> v_target_uid
    and source_proof.session_id <> intent.actor_session_id and target_proof.session_id <> intent.actor_session_id
    and source_proof.session_id <> target_proof.session_id);
  perform pg_temp.proof_accept_post_assert('legs_proved_by_one_transition',
    source_leg_row.state = 'proved' and target_leg_row.state = 'proved'
    and source_leg_row.revision >= 1 and target_leg_row.revision >= 1);
  perform pg_temp.proof_accept_post_assert('intent_progressed_without_owner_move',
    intent.target_uid = v_target_uid and intent.state in ('both_proved', 'already_linked')
    and not exists(select 1 from kaq_private.learning_session_grants grant_row
      where grant_row.session_id in (source_proof.session_id, target_proof.session_id)));
  perform pg_temp.proof_accept_post_assert('source_snapshot_still_current',
    (source_proof.account_id is null and source_proof.membership_epoch is null
      and source_proof.account_membership_revision is null
      and not exists(select 1 from kaq_private.learning_memberships m where m.auth_user_id = v_source_uid))
    or (source_proof.account_membership_revision = source_account.membership_revision
      and source_proof.account_id is not null and source_proof.membership_epoch is not null));
  perform pg_temp.proof_accept_post_assert('target_snapshot_is_atomic',
    (target_proof.account_id is null and target_proof.membership_epoch is null and target_proof.account_membership_revision is null)
    or (target_proof.account_id is not null and target_proof.membership_epoch is not null and target_proof.account_membership_revision is not null));
  perform pg_temp.proof_accept_post_assert('owner_is_resolved_from_membership_not_auth_uid',
    exists(select 1 from kaq_private.account_proofs p join kaq_private.learning_memberships m
      on m.auth_user_id=p.auth_uid where p.intent_id=v_intent_id and p.account_id=m.account_id
      and p.membership_epoch=m.epoch and p.account_id<>p.auth_uid)
    and not exists(select 1 from kaq_private.account_proofs p where p.intent_id=v_intent_id
      and p.account_id is not null and not exists(select 1 from kaq_private.learning_memberships m
        join kaq_private.learning_accounts a on a.id=m.account_id where m.auth_user_id=p.auth_uid
        and m.account_id=p.account_id and m.epoch=p.membership_epoch
        and a.membership_revision=p.account_membership_revision)));
end $$;
select jsonb_build_object('status', 'passed', 'checks', (select jsonb_agg(name order by name) from proof_accept_post_checks),
  'checkCount', (select count(*) from proof_accept_post_checks), 'transaction', 'rolled_back');
rollback;
