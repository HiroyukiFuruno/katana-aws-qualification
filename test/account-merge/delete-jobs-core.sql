-- 実OAuth所有者のDB境界を検査し、全変更をrollbackする。
begin;
set local timezone = 'UTC';
create temporary table deleted_auth_preimage on commit drop as
  select * from auth.users where id = %ACCOUNT%;
delete from kaq_private.learning_session_grants where auth_user_id in (%ACCOUNT%,%ANCHOR%);
delete from kaq_private.account_committed_proof_bindings where auth_user_id in (%ACCOUNT%,%ANCHOR%);
delete from kaq_private.learning_memberships where auth_user_id in (%ACCOUNT%,%ANCHOR%);
insert into kaq_private.learning_accounts(id) values (%ACCOUNT%);
update kaq_private.learning_accounts set status='deleting',session_fence_at='2099-01-01T00:00:00Z' where id=%ACCOUNT%;
insert into kaq_private.learning_memberships(auth_user_id,account_id,status,session_fence_at)
values (%ACCOUNT%,%ACCOUNT%,'disabled','2099-01-01T00:00:00Z'),
  (%ANCHOR%,%ACCOUNT%,'disabled','2099-01-01T00:00:00Z');
do $fixture$
declare job uuid; receipt uuid; lease uuid; target uuid; anchor_target boolean; restore_columns text;
begin
  insert into kaq_private.account_delete_jobs(authority_state,authority_approved_at,
    scope_account_id,scope_fence_at,scope_commitment,content_erased_at,content_commitment,
    capability_hash,capability_expires_at,target_count)
  values ('approved',clock_timestamp(),%ACCOUNT%,'2099-01-01T00:00:00Z',repeat('a',32)::bytea,
    clock_timestamp(),repeat('b',32)::bytea,repeat('c',32)::bytea,clock_timestamp()+interval '1 hour',2)
  returning id,receipt_id into job,receipt;
  insert into kaq_private.account_delete_job_targets(job_id,ordinal,auth_uid,is_anchor)
    values (job,0,%ACCOUNT%,false),(job,1,%ANCHOR%,true);
  select lease_id into lease from kaq_private.claim_account_delete_job();
  if lease is null then raise exception 'initial claim failed'; end if;
  select auth_uid,is_anchor into target,anchor_target from kaq_private.next_account_delete_target(lease);
  if target is distinct from %ACCOUNT%::uuid or anchor_target is distinct from false
    then raise exception 'non-anchor order failed'; end if;
  if kaq_private.confirm_account_delete_target_absent(lease,target)
    then raise exception 'present Auth UID was confirmed'; end if;
  begin
    perform kaq_private.defer_account_delete_job(lease,null);
    raise exception 'NULL reason accepted';
  exception when sqlstate 'PT400' then null; end;
  -- DELETE成功直後の停止後、期限切れleaseから未確認targetを回収する。
  delete from auth.users where id=target;
  update kaq_private.account_delete_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=job;
  select lease_id into lease from kaq_private.claim_account_delete_job();
  if lease is null then raise exception 'post-delete recovery claim failed'; end if;
  select auth_uid into target from kaq_private.next_account_delete_target(lease);
  if target is distinct from %ACCOUNT%::uuid then raise exception 'recovery target missing'; end if;
  if not kaq_private.confirm_account_delete_target_absent(lease,target)
    then raise exception 'absent recovered target not confirmed'; end if;
  perform kaq_private.defer_account_delete_job(lease,'auth_unavailable');
  if exists(select 1 from kaq_private.claim_account_delete_job())
    then raise exception 'retry ignored backoff'; end if;
  update kaq_private.account_delete_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=job;
  select lease_id into lease from kaq_private.claim_account_delete_job();
  select auth_uid,is_anchor into target,anchor_target from kaq_private.next_account_delete_target(lease);
  if lease is null or target is distinct from %ANCHOR%::uuid or anchor_target is distinct from true
    then raise exception 'anchor recovery failed'; end if;
  delete from auth.users where id=target;
  if not kaq_private.confirm_account_delete_target_absent(lease,target)
    then raise exception 'anchor absence not confirmed'; end if;
  -- 全targetを404相当として確認した後にUIDを再作成し、未処理anchorによる偽陰性を避ける。
  select string_agg(quote_ident(attname),',' order by attnum) into restore_columns
    from pg_attribute where attrelid='auth.users'::regclass and attnum>0 and not attisdropped
      and attgenerated='' and attidentity='';
  execute format('insert into auth.users (%1$s) select %1$s from deleted_auth_preimage',restore_columns);
  if kaq_private.complete_account_delete_job(lease)
    then raise exception 'recreated Auth UID allowed completion'; end if;
  delete from auth.users where id=%ACCOUNT%;
  if not kaq_private.complete_account_delete_job(lease) then raise exception 'completion failed'; end if;
  if exists(select 1 from kaq_private.account_delete_jobs where id=job)
    or exists(select 1 from kaq_private.account_delete_job_targets where job_id=job)
    or kaq_private.read_account_delete_receipt(receipt) is distinct from 'completed'
    then raise exception 'minimal receipt cleanup failed'; end if;
end $fixture$;
select 'delete_job_core_assertions_passed';
rollback;
