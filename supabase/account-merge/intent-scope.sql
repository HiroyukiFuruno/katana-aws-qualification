-- preview/commit 前の private scope 固定。所有移動・data mutation・digest は別部品。
create function kaq_private.lock_account_intent_scope(
  p_intent_id uuid, p_intent_secret text, p_expected_revision bigint
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, kaq_private, extensions
as $$
declare
  initial_context jsonb; context jsonb; intent kaq_private.account_intents%rowtype;
  proof_rows jsonb; current_proofs jsonb; initial_members jsonb; current_members jsonb; initial_accounts jsonb; current_accounts jsonb;
  initial_generations jsonb; current_generations jsonb; initial_main_grant jsonb; current_main_grant jsonb;
  account_ids uuid[]; discovered_member_uids uuid[]; current_member_uids uuid[]; candidate_uids uuid[]; proof_session_ids uuid[]; session_ids uuid[];
  item uuid; session_owner uuid; live auth.sessions%rowtype;
  actor_member kaq_private.learning_memberships%rowtype; generation_rows jsonb; locked_count bigint;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ISOLATION_UNSUPPORTED';
  end if;
  if p_intent_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_intent_secret is null or p_intent_secret !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'PT404', message = 'KAQ_INTENT_NOT_FOUND';
  end if;
  if current_setting('kaq.intent_scope_used', true) = '1' then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_REENTRY';
  end if;
  perform set_config('kaq.intent_scope_used', '1', true);
  initial_context := kaq_private.lock_request_context();
  perform pg_advisory_xact_lock(hashtextextended('kaq.account-intent.actor:' || (initial_context ->> 'actor_uid'), 581121));
  select * into intent from kaq_private.account_intents where id = p_intent_id
    and actor_uid = (initial_context ->> 'actor_uid')::uuid
    and actor_session_id = (initial_context ->> 'session_id')::uuid for update;
  if not found or intent.secret_hash is distinct from extensions.digest(decode(p_intent_secret, 'hex'), 'sha256') then
    raise exception using errcode = 'PT404', message = 'KAQ_INTENT_NOT_FOUND';
  end if;
  if intent.revision <> p_expected_revision then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_STALE'; end if;
  if intent.expires_at <= clock_timestamp() then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_EXPIRED'; end if;
  if intent.state not in ('both_proved', 'previewed') then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_STATE'; end if;
  if intent.kind not in ('add_existing', 'merge_existing') or intent.target_uid is null then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_STATE';
  end if;
  if (intent.kind = 'add_existing' and (intent.source_account_id is not null or intent.target_account_id is null))
    or (intent.kind = 'merge_existing' and intent.source_account_id is null) then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_STATE';
  end if;
  perform 1 from kaq_private.account_proofs proof join kaq_private.account_proof_legs leg on leg.id = proof.leg_id
    where proof.intent_id = intent.id and leg.side in ('source','target') for share;
  select jsonb_agg(jsonb_build_object('id',proof.id,'side',leg.side,'uid',proof.auth_uid,'session',proof.session_id,
    'session_created_at',proof.session_created_at,'oauth_at',proof.oauth_at,'consumed_at',proof.consumed_at,
    'account',proof.account_id,'epoch',proof.membership_epoch,'revision',proof.account_membership_revision,
    'expires_at',proof.expires_at,'leg_issued_at',leg.issued_at,'leg_expires_at',leg.expires_at,'leg_state',leg.state)
    order by leg.side) into proof_rows
    from kaq_private.account_proofs proof join kaq_private.account_proof_legs leg on leg.id = proof.leg_id
    where proof.intent_id = intent.id and leg.side in ('source','target');
  if jsonb_array_length(coalesce(proof_rows, '[]'::jsonb)) <> 2 then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_PROOF';
  end if;
  if (select count(distinct entry->>'session') from jsonb_array_elements(proof_rows) entry) <> 2
    or exists(select 1 from jsonb_array_elements(proof_rows) entry
      where (entry->>'session')::uuid = (initial_context->>'session_id')::uuid) then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_PROOF';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(proof_rows) proof
      where proof ->> 'side' = 'source' and (proof ->> 'uid')::uuid = intent.actor_uid
  ) or not exists (
    select 1 from jsonb_array_elements(proof_rows) proof
      where proof ->> 'side' = 'target' and (proof ->> 'uid')::uuid = intent.target_uid
  ) then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_PROOF';
  end if;
  if exists (
    select 1 from jsonb_array_elements(proof_rows) proof where
      (proof ->> 'side' = 'source' and (proof ->> 'account')::uuid is distinct from intent.source_account_id)
      or (proof ->> 'side' = 'target' and (proof ->> 'account')::uuid is distinct from intent.target_account_id)
  ) then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_PROOF';
  end if;
  if intent.kind = 'merge_existing' and intent.source_account_id is not null
    and intent.target_account_id is not null and intent.source_account_id = intent.target_account_id then
    raise exception using errcode = 'PT409', message = 'KAQ_SAME_ACCOUNT';
  end if;
  select array_agg(distinct id order by id) into account_ids from unnest(array[intent.source_account_id, intent.target_account_id]) id where id is not null;
  if intent.kind = 'add_existing' and cardinality(account_ids) <> 1 then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_STATE';
  end if;
  select array_agg(auth_user_id order by auth_user_id) into discovered_member_uids
    from kaq_private.learning_memberships where account_id = any(coalesce(account_ids, '{}'::uuid[]));
  select array_agg(distinct uid order by uid) into candidate_uids from (
    select unnest(coalesce(discovered_member_uids, '{}'::uuid[])) uid
    union all select (initial_context ->> 'actor_uid')::uuid
    union all select intent.target_uid
  ) values;
  foreach item in array candidate_uids loop
    perform 1 from auth.users where id = item for share;
    if not found then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_RETRY'; end if;
  end loop;
  select array_agg((entry->>'session')::uuid order by (entry->>'session')::uuid) into proof_session_ids
    from jsonb_array_elements(proof_rows) entry;
  select array_agg(distinct value order by value) into session_ids from unnest(array[(initial_context ->> 'session_id')::uuid]
    || coalesce(proof_session_ids, '{}'::uuid[])) value;
  foreach item in array session_ids loop
    begin select * into live from auth.sessions where id = item for share nowait;
    exception when lock_not_available then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_RETRY'; end;
    if not found or not live.user_id = any(candidate_uids) then raise exception using errcode = '28000', message = 'KAQ_SESSION_INVALID'; end if;
  end loop;
  begin
    perform 1 from auth.mfa_amr_claims where session_id = any(session_ids)
      order by session_id, authentication_method for share nowait;
  exception when lock_not_available then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_RETRY'; end;
  begin perform 1 from auth.mfa_factors where user_id = any(candidate_uids) and status = 'verified' order by user_id,id for share nowait;
  exception when lock_not_available then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_RETRY'; end;
  select array_agg(auth_user_id order by auth_user_id) into current_member_uids
    from kaq_private.learning_memberships where account_id = any(coalesce(account_ids, '{}'::uuid[]));
  if current_member_uids is distinct from discovered_member_uids then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_RETRY';
  end if;
  if cardinality(account_ids) > 0 then
    select jsonb_agg(jsonb_build_object('account_id',id,'revision',membership_revision,'fence',session_fence_at) order by id)
      into initial_accounts from kaq_private.learning_accounts where id = any(account_ids);
    select jsonb_agg(jsonb_build_object('uid',auth_user_id,'account_id',account_id,'epoch',epoch,'status',status,'fence',session_fence_at) order by auth_user_id)
      into initial_members from kaq_private.learning_memberships where account_id = any(account_ids);
    select jsonb_agg(jsonb_build_object('account_id',user_id,'generation',generation) order by user_id)
      into initial_generations from public.learning_state where user_id = any(account_ids);
    if intent.source_account_id is not null then
      select jsonb_build_object('actor',auth_user_id,'account',account_id,'epoch',membership_epoch,
        'reason',reason,'revoked',revoked_at) into initial_main_grant
        from kaq_private.learning_session_grants
        where session_id = (initial_context ->> 'session_id')::uuid;
    end if;
    perform 1 from public.learning_state where user_id = any(account_ids) order by user_id for update;
    get diagnostics locked_count = row_count;
    if locked_count <> cardinality(account_ids) then raise exception using errcode = 'PT409', message = 'KAQ_STATE_UNAVAILABLE'; end if;
    perform 1 from kaq_private.learning_accounts where id = any(account_ids) order by id for update;
    perform 1 from kaq_private.learning_memberships where account_id = any(account_ids) order by auth_user_id for update;
    perform 1 from kaq_private.learning_session_grants where account_id = any(account_ids) order by session_id for update;
  end if;
  foreach item in array session_ids loop
    select user_id into session_owner from auth.sessions where id = item;
    perform kaq_private.assert_live_session(session_owner, item, true);
  end loop;
  context := kaq_private.lock_request_context();
  if context ->> 'actor_uid' is distinct from initial_context ->> 'actor_uid' or context ->> 'session_id' is distinct from initial_context ->> 'session_id' then
    raise exception using errcode = '28000', message = 'KAQ_AUTH_CONTEXT_INVALID';
  end if;
  select jsonb_agg(jsonb_build_object('account_id',id,'revision',membership_revision,'fence',session_fence_at) order by id)
    into current_accounts from kaq_private.learning_accounts where id = any(coalesce(account_ids, '{}'::uuid[])) and status = 'active';
  select jsonb_agg(jsonb_build_object('uid',auth_user_id,'account_id',account_id,'epoch',epoch,'status',status,'fence',session_fence_at) order by auth_user_id)
    into current_members from kaq_private.learning_memberships where account_id = any(coalesce(account_ids, '{}'::uuid[]));
  -- 下位lockの待機中に加わったAuth UIDは、初期発見集合と一致しなければ採用しない。
  select array_agg((member ->> 'uid')::uuid order by (member ->> 'uid')::uuid) into current_member_uids
    from jsonb_array_elements(coalesce(current_members, '[]'::jsonb)) member;
  if current_member_uids is distinct from discovered_member_uids then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_RETRY';
  end if;
  select jsonb_agg(jsonb_build_object('id',proof.id,'side',leg.side,'uid',proof.auth_uid,'session',proof.session_id,
    'session_created_at',proof.session_created_at,'oauth_at',proof.oauth_at,'consumed_at',proof.consumed_at,
    'account',proof.account_id,'epoch',proof.membership_epoch,'revision',proof.account_membership_revision,
    'expires_at',proof.expires_at,'leg_issued_at',leg.issued_at,'leg_expires_at',leg.expires_at,'leg_state',leg.state)
    order by leg.side) into current_proofs
    from kaq_private.account_proofs proof join kaq_private.account_proof_legs leg on leg.id = proof.leg_id
    where proof.intent_id = intent.id and leg.side in ('source','target');
  select jsonb_agg(jsonb_build_object('account_id',user_id,'generation',generation) order by user_id)
    into current_generations from public.learning_state where user_id = any(coalesce(account_ids, '{}'::uuid[]));
  if current_accounts is distinct from initial_accounts or current_members is distinct from initial_members
    or current_proofs is distinct from proof_rows or current_generations is distinct from initial_generations
    or exists(select 1 from jsonb_array_elements(current_proofs) proof where (proof->>'expires_at')::timestamptz <= clock_timestamp())
    or exists(
      select 1 from jsonb_array_elements(current_proofs) proof
        left join kaq_private.learning_memberships member on member.auth_user_id = (proof ->> 'uid')::uuid
        left join kaq_private.learning_accounts account on account.id = (proof ->> 'account')::uuid
        where ((proof ->> 'account') is null and member.auth_user_id is not null)
          or ((proof ->> 'account') is not null and (
            member.auth_user_id is null or member.status <> 'active'
            or member.account_id <> (proof ->> 'account')::uuid
            or member.epoch <> (proof ->> 'epoch')::bigint
            or account.status <> 'active'
            or account.membership_revision <> (proof ->> 'revision')::bigint
          ))
    )
    or exists(
      select 1 from jsonb_array_elements(current_proofs) proof
        join auth.sessions proof_session on proof_session.id = (proof ->> 'session')::uuid
        where proof_session.user_id <> (proof ->> 'uid')::uuid
    )
    or exists(
      select 1 from jsonb_array_elements(current_proofs) proof
        left join auth.sessions proof_session on proof_session.id = (proof ->> 'session')::uuid
        left join auth.mfa_amr_claims oauth_amr on oauth_amr.session_id = proof_session.id
          and oauth_amr.authentication_method = 'oauth'
        where proof_session.user_id is distinct from (proof ->> 'uid')::uuid
          or proof_session.created_at is distinct from (proof ->> 'session_created_at')::timestamptz
          or proof_session.created_at < (proof ->> 'leg_issued_at')::timestamptz
          or oauth_amr.updated_at is distinct from (proof ->> 'oauth_at')::timestamptz
          or oauth_amr.updated_at is null or not isfinite(oauth_amr.updated_at)
          or oauth_amr.updated_at > clock_timestamp() + interval '5 seconds'
          or oauth_amr.updated_at < (proof ->> 'leg_issued_at')::timestamptz
          or proof ->> 'leg_state' <> 'proved'
          or (proof ->> 'leg_expires_at')::timestamptz <= clock_timestamp()
          or (proof ->> 'expires_at')::timestamptz <= clock_timestamp()
          or proof ->> 'consumed_at' is not null
    )
    or (select revision from kaq_private.account_intents where id = intent.id) <> p_expected_revision then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_SCOPE_RETRY';
  end if;
  if (context ->> 'bound')::boolean then
    select * into actor_member from kaq_private.learning_memberships where auth_user_id = (context ->> 'actor_uid')::uuid;
    if not found or (context ->> 'expected_account')::uuid is distinct from actor_member.account_id or (context ->> 'expected_epoch')::bigint is distinct from actor_member.epoch then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
  end if;
  if intent.source_account_id is not null then
    select jsonb_build_object('actor',auth_user_id,'account',account_id,'epoch',membership_epoch,
      'reason',reason,'revoked',revoked_at) into current_main_grant
      from kaq_private.learning_session_grants
      where session_id = (initial_context ->> 'session_id')::uuid;
    if current_main_grant is distinct from initial_main_grant
      or current_main_grant is null
      or (current_main_grant ->> 'actor')::uuid is distinct from intent.actor_uid
      or (current_main_grant ->> 'account')::uuid is distinct from intent.source_account_id
      or (current_main_grant ->> 'epoch')::bigint is distinct from (
        select epoch from kaq_private.learning_memberships where auth_user_id = intent.actor_uid
      )
      or current_main_grant ->> 'reason' is distinct from initial_main_grant ->> 'reason'
      or current_main_grant ->> 'revoked' is not null then
      raise exception using errcode = 'PT401', message = 'KAQ_REAUTHENTICATION_REQUIRED';
    end if;
  end if;
  if (select expires_at from kaq_private.account_intents where id = intent.id) <= clock_timestamp() then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_EXPIRED';
  end if;
  -- 両proofがfreshでも、通常操作を開始したmain sessionの失効は無効化しない。
  -- 下位lock後に既存grant/fenceも照合し、初回Auth-onlyには学習accountを作らない。
  if intent.source_account_id is not null then
    if kaq_private.read_learning_account() is distinct from intent.source_account_id then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
  end if;
  generation_rows := current_generations;
  return jsonb_strip_nulls(jsonb_build_object('operation','intent_scope','intent_id',intent.id,'intent_state',intent.state,
    'intent_revision',intent.revision,'existing_account_ids',account_ids,'generations',generation_rows,
    'membership_count',jsonb_array_length(coalesce(current_members, '[]'::jsonb))));
end $$;
revoke all on function kaq_private.lock_account_intent_scope(uuid,text,bigint) from public, anon, authenticated, service_role;
