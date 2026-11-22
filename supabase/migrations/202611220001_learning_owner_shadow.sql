-- #58の最初のshadow/backfill。公開所有者境界はまだAuth UIDのまま維持する。
begin;
set transaction isolation level serializable;

do $owner_shadow$
declare
  owner_ids uuid[];
  locked_count bigint;
  checked_at timestamptz;
begin
  select array_agg(user_id order by user_id) into owner_ids from (
    select user_id from public.learning_state union
    select user_id from public.learning_events union
    select user_id from public.exam_sessions union
    select user_id from public.exam_responses union
    select user_id from public.earned_certifications union
    select user_id from public.assessment_answers union
    select user_id from public.roadmap_profiles union
    select user_id from public.migration_manifests union
    select user_id from public.migration_items union
    select user_id from public.fundamentals_unit_progress union
    select user_id from public.fundamentals_final_sessions union
    select user_id from public.dashboard_settings
  ) owner_union;
  if owner_ids is null then return; end if;

  -- 全ownerを同じ上位→下位順でlockする。競合は待機せずmigration全体をretryする。
  begin
    -- GoTrue refreshと同じくuserは順序を固定して保持し、session以下はNOWAITでretryする。
    perform 1 from auth.users where id = any(owner_ids) order by id for share nowait;
    get diagnostics locked_count = row_count;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_OWNER_SHADOW_RETRY';
  end;
  if locked_count <> cardinality(owner_ids) then
    raise exception using errcode = 'PT400', message = 'KAQ_OWNER_SHADOW_AUTH_MISSING';
  end if;
  begin
    perform 1 from auth.sessions where user_id = any(owner_ids) order by id for share nowait;
    perform 1 from auth.mfa_amr_claims where session_id in (
      select id from auth.sessions where user_id = any(owner_ids)
    ) order by session_id, authentication_method for share nowait;
    perform 1 from public.learning_state where user_id = any(owner_ids) order by user_id for update nowait;
    perform 1 from kaq_private.learning_accounts where id = any(owner_ids) order by id for update nowait;
    perform 1 from kaq_private.learning_memberships where auth_user_id = any(owner_ids)
      order by auth_user_id for update nowait;
  exception when lock_not_available then
    raise exception using errcode = 'PT409', message = 'KAQ_OWNER_SHADOW_RETRY';
  end;

  checked_at := clock_timestamp();
  if exists (
    select 1 from auth.users where id = any(owner_ids)
      and (deleted_at is not null or banned_until > checked_at)
  ) then raise exception using errcode = 'PT400', message = 'KAQ_OWNER_SHADOW_AUTH_INVALID'; end if;

  if not exists (
    select 1 from pg_attribute attribute
    where attribute.attrelid = 'public.learning_state'::regclass
      and attribute.attname = 'generation' and not attribute.attisdropped
  ) then raise exception using errcode = 'PT400', message = 'KAQ_OWNER_SHADOW_STATE_SCHEMA'; end if;

  if exists (select 1 from kaq_private.learning_accounts where id = any(owner_ids))
    or exists (select 1 from kaq_private.learning_memberships where auth_user_id = any(owner_ids))
    or exists (select 1 from kaq_private.learning_session_grants
      where auth_user_id = any(owner_ids) or account_id = any(owner_ids))
    or exists (select 1 from kaq_private.account_intents
      where actor_uid = any(owner_ids) or target_uid = any(owner_ids)
        or source_account_id = any(owner_ids) or target_account_id = any(owner_ids))
    or exists (select 1 from kaq_private.account_proofs
      where auth_uid = any(owner_ids) or account_id = any(owner_ids))
    or exists (select 1 from kaq_private.account_merge_receipts where canonical_account_id = any(owner_ids))
    or exists (select 1 from kaq_private.account_merge_archives
      where canonical_account_id = any(owner_ids) or origin_account_id = any(owner_ids))
    or exists (select 1 from kaq_private.account_merge_id_maps
      where canonical_account_id = any(owner_ids) or origin_account_id = any(owner_ids))
  then raise exception using errcode = 'PT400', message = 'KAQ_OWNER_SHADOW_PRIVATE_CONFLICT'; end if;

  insert into kaq_private.learning_accounts(id) select unnest(owner_ids);
  insert into kaq_private.learning_memberships(auth_user_id, account_id)
    select id, id from auth.users where id = any(owner_ids) order by id;
  insert into public.learning_state(user_id, generation)
    select owner_id, 0 from unnest(owner_ids) owner_id
    where not exists (select 1 from public.learning_state state where state.user_id = owner_id);
  select count(*) into locked_count from public.learning_state where user_id = any(owner_ids);
  if locked_count <> cardinality(owner_ids) then
    raise exception using errcode = 'PT400', message = 'KAQ_OWNER_SHADOW_STATE_CONFLICT';
  end if;

  -- 下位lockとstate追加後に時刻を再取得する。created_atの+5秒許容だけは既存resolverと同じ。
  checked_at := clock_timestamp();
  insert into kaq_private.learning_session_grants(
    session_id, auth_user_id, account_id, membership_epoch, reason
  )
  select session.id, member.auth_user_id, member.account_id, member.epoch, 'legacy'
  from auth.sessions session
  join kaq_private.learning_memberships member on member.auth_user_id = session.user_id
  join kaq_private.learning_accounts account on account.id = member.account_id
  join auth.users owner on owner.id = session.user_id
  where session.user_id = any(owner_ids)
    and owner.deleted_at is null
    and (owner.banned_until is null or owner.banned_until <= checked_at)
    and session.created_at is not null and isfinite(session.created_at)
    and session.created_at > 'epoch'::timestamptz and session.created_at <= checked_at + interval '5 seconds'
    and (session.not_after is null or (isfinite(session.not_after) and session.not_after > checked_at))
    and session.oauth_client_id is null
    and exists (select 1 from auth.mfa_amr_claims amr
      where amr.session_id = session.id and amr.authentication_method = 'oauth')
    and member.account_id = member.auth_user_id and member.epoch = 0 and member.status = 'active'
    and member.session_fence_at is null and account.status = 'active'
    and account.membership_revision = 0 and account.session_fence_at is null
    and not exists (select 1 from kaq_private.learning_memberships other
      where other.account_id = account.id and other.auth_user_id <> member.auth_user_id);
end $owner_shadow$;

commit;
