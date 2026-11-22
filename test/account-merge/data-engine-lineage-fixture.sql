-- Native component fixture. __A/__B are smoke owners with seeded rows; __C is the signed sdk-first owner.
-- The driver substitutes only real Auth UID/session pairs and executes this whole file inside one rollback TX.
begin;
create temporary table lineage_fixture(receipt uuid primary key, source_id uuid, canonical_id uuid, snapshot jsonb, digest text) on commit drop;
create temporary table lineage_ab_immutable(kind text primary key, payload jsonb not null) on commit drop;
create function pg_temp.assert_lineage(label text, ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'lineage fixture: %', label; end if; end $$;
create function pg_temp.lineage_fixture_state() returns jsonb language plpgsql as $$
declare state jsonb := '{}'::jsonb; relation_name text; rows jsonb;
begin
  foreach relation_name in array array[
    'assessment_answers','dashboard_settings','earned_certifications','exam_responses','exam_sessions',
    'fundamentals_final_sessions','fundamentals_unit_progress','learning_events','learning_state',
    'migration_items','migration_manifests','roadmap_profiles'
  ] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text collate "C"),''[]''::jsonb) from public.%I row', relation_name)
      into rows;
    state := state || jsonb_build_object('public.' || relation_name, rows);
  end loop;
  foreach relation_name in array array[
    'learning_accounts','learning_memberships','learning_session_grants','account_intents','account_merge_receipts',
    'account_merge_archives','account_merge_id_maps','account_merge_resolution_choices','account_merge_deferred_rows',
    'account_merge_resume_heads','account_merge_replay_heads','account_merge_lineage_closure'
  ] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text collate "C"),''[]''::jsonb) from kaq_private.%I row', relation_name)
      into rows;
    state := state || jsonb_build_object('kaq_private.' || relation_name, rows);
  end loop;
  return state;
end $$;
create function pg_temp.expect_scope_rejection(
  label text, receipt_id uuid, source_id uuid, canonical_id uuid, scopes jsonb, expected_message text
) returns void language plpgsql as $$
declare before_state jsonb := pg_temp.lineage_fixture_state(); actual_message text;
begin
  begin
    update kaq_private.account_merge_receipts set before_scopes=scopes where id=receipt_id;
    perform kaq_private.advance_merge_lineage(receipt_id,source_id,canonical_id);
    raise exception 'lineage fixture: % accepted', label;
  exception when sqlstate 'PT409' then
    get stacked diagnostics actual_message = message_text;
    perform pg_temp.assert_lineage(label || '_message',actual_message=expected_message);
  end;
  perform pg_temp.assert_lineage(label || '_unchanged',pg_temp.lineage_fixture_state() is not distinct from before_state);
end $$;
create function pg_temp.before_scope(a uuid, b uuid) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('account_id',account.id,'generation',state.generation,
    'membership_revision',account.membership_revision,'memberships',members.rows) order by account.id)
  from kaq_private.learning_accounts account join public.learning_state state on state.user_id=account.id
  cross join lateral (select coalesce(jsonb_agg(jsonb_build_object('auth_user_id',member.auth_user_id,'epoch',member.epoch)
    order by member.auth_user_id),'[]'::jsonb) rows from kaq_private.learning_memberships member where member.account_id=account.id) members
  where account.id in (a,b)
$$;
create function pg_temp.choices(snapshot jsonb, source_id uuid, canonical_id uuid) returns jsonb language plpgsql as $$
declare result jsonb := jsonb_build_object('version',1,'assessment','{}'::jsonb,'dashboard',jsonb_build_object('*','canonical'),
  'roadmap',jsonb_build_object('*','canonical'),'final_resume','{}'::jsonb,'manifest_head','{}'::jsonb); row jsonb;
  selected_manifest uuid; head_count bigint; candidate_count bigint;
begin
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.assessment_answers')
    where (value->>'user_id')::uuid=source_id loop
    result:=jsonb_set(result,array['assessment',row->>'assessment_id'],'"source"'::jsonb);
  end loop;
  for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.fundamentals_final_sessions')
    where (value->>'user_id')::uuid=source_id and value->>'state'='draft' and coalesce((value->>'is_active')::boolean,true) loop
    result:=jsonb_set(result,array['final_resume',(row->>'unit_id')||':'||(row->>'content_version')],to_jsonb('source:'||(row->>'session_id')));
  end loop;
  for row in select jsonb_build_object('source_name',value->>'source_name','source_fingerprint',value->>'source_fingerprint')
    from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests') where (value->>'user_id')::uuid=source_id
    group by value->>'source_name',value->>'source_fingerprint' loop
    select count(*),(array_agg(head.manifest_id order by head.manifest_id))[1] into head_count,selected_manifest
      from kaq_private.account_merge_replay_heads head where head.canonical_account_id=source_id
        and head.source_name=row->>'source_name' and head.source_fingerprint=row->>'source_fingerprint';
    if head_count=0 then
      select count(*),(array_agg((value->>'manifest_id')::uuid order by (value->>'manifest_id')::uuid))[1]
        into candidate_count,selected_manifest from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests')
        where (value->>'user_id')::uuid=source_id and value->>'source_name'=row->>'source_name'
          and value->>'source_fingerprint'=row->>'source_fingerprint';
      if candidate_count<>1 then
        raise exception 'lineage fixture: manifest candidates are ambiguous for source scope';
      end if;
    elsif head_count<>1 or not exists(select 1 from jsonb_array_elements(snapshot->'document'->'tables'->'public.migration_manifests')
      where (value->>'user_id')::uuid=source_id and (value->>'manifest_id')::uuid=selected_manifest
        and value->>'source_name'=row->>'source_name' and value->>'source_fingerprint'=row->>'source_fingerprint') then
      raise exception 'lineage fixture: manifest replay head is outside source scope';
    end if;
    result:=jsonb_set(result,array['manifest_head',(row->>'source_name')||':'||(row->>'source_fingerprint')],to_jsonb('source:'||selected_manifest));
  end loop;
  return result;
end $$;
create function pg_temp.move_then_advance(receipt_id uuid, source_id uuid, canonical_id uuid) returns void language plpgsql as $$
begin
  delete from kaq_private.learning_session_grants where account_id in(source_id,canonical_id);
  update kaq_private.learning_memberships set account_id=canonical_id,epoch=epoch+1,session_fence_at=clock_timestamp(),updated_at=clock_timestamp() where account_id in(source_id,canonical_id);
  update kaq_private.learning_accounts set membership_revision=membership_revision+1,session_fence_at=clock_timestamp() where id=canonical_id;
  update kaq_private.learning_accounts set status='retired',retired_at=clock_timestamp(),membership_revision=membership_revision+1,session_fence_at=clock_timestamp() where id=source_id;
  perform kaq_private.advance_merge_lineage(receipt_id,source_id,canonical_id);
end $$;
do $$
declare a uuid:='__A_ACCOUNT__'; b uuid:='__B_ACCOUNT__'; c uuid:='__C_ACCOUNT__';
  a_uid uuid:='__A_AUTH_UID__'; b_uid uuid:='__B_AUTH_UID__'; c_uid uuid:='__C_AUTH_UID__';
  a_sid uuid:='__A_SESSION_ID__'; b_sid uuid:='__B_SESSION_ID__'; c_sid uuid:='__C_SESSION_ID__';
  ab_receipt uuid:=gen_random_uuid(); bc_receipt uuid:=gen_random_uuid(); ab_intent uuid:=gen_random_uuid(); bc_intent uuid:=gen_random_uuid();
  active_receipt uuid:=gen_random_uuid(); active_intent uuid:=gen_random_uuid(); cycle_receipt uuid:=gen_random_uuid(); cycle_intent uuid:=gen_random_uuid();
  remnant_receipt uuid:=gen_random_uuid(); remnant_intent uuid:=gen_random_uuid(); snap jsonb; choice jsonb; scopes jsonb;
  before_state jsonb; actual_message text; table_name text;
begin
  perform pg_temp.assert_lineage('actual_auth', (select count(*) from (values(a_uid,a_sid),(b_uid,b_sid),(c_uid,c_sid)) v(uid,sid)
    join auth.sessions session on session.id=v.sid and session.user_id=v.uid)=3);
  perform pg_temp.assert_lineage('c_guest_state_only', exists(select 1 from public.learning_state where user_id=c)
    and not exists(select 1 from kaq_private.learning_accounts where id=c)
    and not exists(select 1 from kaq_private.learning_memberships where auth_user_id=c_uid));
  insert into kaq_private.learning_accounts(id) values(c);
  insert into kaq_private.learning_memberships(auth_user_id,account_id) values(c_uid,c);
  -- Each pass materializes its exact v2 snapshot before the receipt; current receipt is excluded inside engine.
  snap:=kaq_private.capture_merge_snapshot_v2(array[a,b],null); choice:=pg_temp.choices(snap,a,b);
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,source_account_id,source_membership_epoch,target_uid,target_account_id,target_membership_epoch,state,expires_at)
    values(ab_intent,'merge_existing',a_uid,a_sid,decode(repeat('ab',32),'hex'),a,0,b_uid,b,0,'committed',clock_timestamp()+interval '5 minutes');
  insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
    values(ab_receipt,ab_intent,b,2,decode(repeat('ab',32),'hex'),pg_temp.before_scope(a,b),choice,'{}');
  before_state:=pg_temp.lineage_fixture_state();
  begin
    perform kaq_private.apply_merge_data_engine(ab_receipt,a,b,repeat('0',64),(select generation from public.learning_state where user_id=b),choice);
    raise exception 'lineage fixture: digest_drift accepted';
  exception when sqlstate 'PT409' then
    get stacked diagnostics actual_message = message_text;
    perform pg_temp.assert_lineage('digest_drift_message',actual_message='KAQ_MERGE_DIGEST_CHANGED');
  end;
  perform pg_temp.assert_lineage('digest_drift_unchanged',pg_temp.lineage_fixture_state() is not distinct from before_state);
  before_state:=pg_temp.lineage_fixture_state();
  begin
    update public.learning_state set generation=generation+1 where user_id=a;
    perform kaq_private.apply_merge_data_engine(ab_receipt,a,b,snap->>'digest',(select generation from public.learning_state where user_id=b),choice);
    raise exception 'lineage fixture: snapshot_drift accepted';
  exception when sqlstate 'PT409' then
    get stacked diagnostics actual_message = message_text;
    perform pg_temp.assert_lineage('snapshot_drift_message',actual_message='KAQ_MERGE_DIGEST_CHANGED');
  end;
  perform pg_temp.assert_lineage('snapshot_drift_unchanged',pg_temp.lineage_fixture_state() is not distinct from before_state);
  perform kaq_private.apply_merge_data_engine(ab_receipt,a,b,snap->>'digest',(select generation from public.learning_state where user_id=b),choice);
  perform pg_temp.move_then_advance(ab_receipt,a,b);
  insert into lineage_ab_immutable values
    ('receipt',(select to_jsonb(receipt) from kaq_private.account_merge_receipts receipt where id=ab_receipt)),
    ('archives',(select jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text) from kaq_private.account_merge_archives row where receipt_id=ab_receipt)),
    ('maps',(select jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text) from kaq_private.account_merge_id_maps row where receipt_id=ab_receipt));
  insert into lineage_fixture values(ab_receipt,a,b,snap,snap->>'digest');
  -- 実在する B/C 所有者だけを使い、savepoint 内で A を一時的に復帰させる。
  -- closure を公開する前に、helper が active な履歴祖先を拒否しなければならない。
  before_state:=pg_temp.lineage_fixture_state();
  begin
    insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,source_account_id,source_membership_epoch,target_uid,target_account_id,target_membership_epoch,state,expires_at)
      values(active_intent,'merge_existing',b_uid,b_sid,decode(repeat('ef',32),'hex'),b,1,c_uid,c,0,'committed',clock_timestamp()+interval '5 minutes');
    insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
      values(active_receipt,active_intent,c,2,decode(repeat('ef',32),'hex'),pg_temp.before_scope(b,c),choice,'{}');
    delete from kaq_private.learning_session_grants where account_id in(b,c);
    update kaq_private.learning_memberships set account_id=c,epoch=epoch+1,session_fence_at=clock_timestamp(),updated_at=clock_timestamp() where account_id in(b,c);
    update kaq_private.learning_accounts set membership_revision=membership_revision+1,session_fence_at=clock_timestamp() where id=c;
    update kaq_private.learning_accounts set status='retired',retired_at=clock_timestamp(),membership_revision=membership_revision+1,session_fence_at=clock_timestamp() where id=b;
    update kaq_private.learning_accounts set status='active',retired_at=null where id=a;
    perform kaq_private.advance_merge_lineage(active_receipt,b,c);
    raise exception 'lineage fixture: active_ancestor accepted';
  exception when sqlstate 'PT409' then
    get stacked diagnostics actual_message = message_text;
    perform pg_temp.assert_lineage('active_ancestor_message',actual_message='KAQ_MERGE_LINEAGE_ANCESTOR_ACTIVE');
  end;
  perform pg_temp.assert_lineage('active_ancestor_unchanged',pg_temp.lineage_fixture_state() is not distinct from before_state);
  snap:=kaq_private.capture_merge_snapshot_v2(array[b,c],null); choice:=pg_temp.choices(snap,b,c);
  insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,source_account_id,source_membership_epoch,target_uid,target_account_id,target_membership_epoch,state,expires_at)
    values(bc_intent,'merge_existing',b_uid,b_sid,decode(repeat('cd',32),'hex'),b,1,c_uid,c,0,'committed',clock_timestamp()+interval '5 minutes');
  insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
    values(bc_receipt,bc_intent,c,2,decode(repeat('cd',32),'hex'),pg_temp.before_scope(b,c),choice,'{}');
  perform kaq_private.apply_merge_data_engine(bc_receipt,b,c,snap->>'digest',(select generation from public.learning_state where user_id=c),choice);
  perform pg_temp.move_then_advance(bc_receipt,b,c);
  perform pg_temp.assert_lineage('a_b_to_c',(select count(*) from kaq_private.account_merge_lineage_closure where ancestor_account_id in(a,b) and current_canonical_account_id=c)=2);
  perform pg_temp.assert_lineage('ab_immutable',(select count(*) from kaq_private.account_merge_archives where receipt_id=ab_receipt)>0 and (select count(*) from kaq_private.account_merge_id_maps where receipt_id=ab_receipt)>0);
  perform pg_temp.assert_lineage('ab_bytes_unchanged', not exists(select 1 from lineage_ab_immutable saved where saved.payload is distinct from case saved.kind
    when 'receipt' then (select to_jsonb(receipt) from kaq_private.account_merge_receipts receipt where id=ab_receipt)
    when 'archives' then (select jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text) from kaq_private.account_merge_archives row where receipt_id=ab_receipt)
    else (select jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text) from kaq_private.account_merge_id_maps row where receipt_id=ab_receipt) end));
  perform pg_temp.assert_lineage('replay_terminal',(kaq_private.advance_merge_lineage(ab_receipt,a,b)->>'canonical_account_id')=c::text);
  perform pg_temp.assert_lineage('snapshot_lineage',(kaq_private.capture_merge_snapshot_v2(array[c],null)->'document'->'lineage_accounts') @> to_jsonb(array[a,b,c]));
  scopes:=(select before_scopes from kaq_private.account_merge_receipts where id=ab_receipt);
  perform pg_temp.expect_scope_rejection('memberships_missing',ab_receipt,a,b,jsonb_set(scopes,'{0}',(scopes->0)-'memberships'),'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  perform pg_temp.expect_scope_rejection('memberships_null',ab_receipt,a,b,jsonb_set(scopes,'{0,memberships}','null'::jsonb),'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  perform pg_temp.expect_scope_rejection('memberships_empty',ab_receipt,a,b,jsonb_set(scopes,'{0,memberships}','[]'::jsonb),'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  perform pg_temp.expect_scope_rejection('membership_uid_duplicate',ab_receipt,a,b,jsonb_set(scopes,'{0,memberships}',(scopes->0->'memberships') || (scopes->0->'memberships'->0)),'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  perform pg_temp.expect_scope_rejection('foreign_scope_account',ab_receipt,a,b,jsonb_set(scopes,'{0,account_id}',to_jsonb(c::text)),'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  perform pg_temp.expect_scope_rejection('foreign_membership_uid',ab_receipt,a,b,
    jsonb_set(scopes,'{0,memberships,0,auth_user_id}',to_jsonb(c_uid::text)),'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  perform pg_temp.expect_scope_rejection('stale_membership_epoch',ab_receipt,a,b,
    jsonb_set(scopes,'{0,memberships,0,epoch}',to_jsonb((scopes->0->'memberships'->0->>'epoch')::bigint+1)),
    'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  perform pg_temp.expect_scope_rejection('cross_scope_uid_duplicate',ab_receipt,a,b,
    jsonb_set(scopes,'{1,memberships}',(scopes->1->'memberships')||(scopes->0->'memberships'->0)),
    'KAQ_MERGE_LINEAGE_PROOF_CHANGED');
  -- cycle と残存行の検査も、実在する三つの fixture identity だけを savepoint 内で再配置する。
  before_state:=pg_temp.lineage_fixture_state();
  begin
    update kaq_private.learning_memberships set account_id=b where auth_user_id=b_uid;
    insert into public.learning_state(user_id,generation)
      select b,generation from public.learning_state where user_id=c;
    scopes:=pg_temp.before_scope(c,b);
    insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,source_account_id,source_membership_epoch,target_uid,target_account_id,target_membership_epoch,state,expires_at)
      values(cycle_intent,'merge_existing',c_uid,c_sid,decode(repeat('12',32),'hex'),c,1,b_uid,b,2,'committed',clock_timestamp()+interval '5 minutes');
    insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
      values(cycle_receipt,cycle_intent,b,2,decode(repeat('12',32),'hex'),scopes,choice,'{}');
    update kaq_private.learning_memberships set account_id=b,epoch=epoch+1,session_fence_at=clock_timestamp(),updated_at=clock_timestamp() where account_id in(b,c);
    update kaq_private.learning_accounts set status='active',retired_at=null where id=b;
    update kaq_private.learning_accounts set status='retired',retired_at=clock_timestamp() where id=c;
    delete from public.learning_state where user_id=b;
    update public.learning_state set user_id=b where user_id=c;
    perform kaq_private.advance_merge_lineage(cycle_receipt,c,b);
    raise exception 'lineage fixture: cycle accepted';
  exception when sqlstate 'PT409' then
    get stacked diagnostics actual_message = message_text;
    perform pg_temp.assert_lineage('cycle_message',actual_message='KAQ_MERGE_LINEAGE_CYCLE');
  end;
  perform pg_temp.assert_lineage('cycle_unchanged',pg_temp.lineage_fixture_state() is not distinct from before_state);
  before_state:=pg_temp.lineage_fixture_state();
  begin
    update kaq_private.learning_memberships set account_id=b where auth_user_id=b_uid;
    insert into public.learning_state(user_id,generation)
      select b,generation from public.learning_state where user_id=c;
    scopes:=pg_temp.before_scope(c,b);
    insert into kaq_private.account_intents(id,kind,actor_uid,actor_session_id,secret_hash,source_account_id,source_membership_epoch,target_uid,target_account_id,target_membership_epoch,state,expires_at)
      values(remnant_intent,'merge_existing',c_uid,c_sid,decode(repeat('34',32),'hex'),c,1,b_uid,b,2,'committed',clock_timestamp()+interval '5 minutes');
    insert into kaq_private.account_merge_receipts(id,intent_id,canonical_account_id,algorithm_version,consent_hash,before_scopes,choices,result)
      values(remnant_receipt,remnant_intent,b,2,decode(repeat('34',32),'hex'),scopes,choice,'{}');
    update kaq_private.learning_memberships set account_id=b,epoch=epoch+1,session_fence_at=clock_timestamp(),updated_at=clock_timestamp() where account_id in(b,c);
    update kaq_private.learning_accounts set status='active',retired_at=null where id=b;
    update kaq_private.learning_accounts set status='retired',retired_at=clock_timestamp() where id=c;
    delete from public.learning_state where user_id=b;
    update public.learning_state set user_id=b where user_id=c;
    delete from kaq_private.account_merge_lineage_closure where ancestor_account_id=b;
    -- 直sourceを空にし、retired祖先Aだけの残存行で拒否されることを分離する。
    insert into public.assessment_answers
      select (jsonb_populate_record(null::public.assessment_answers,to_jsonb(assessment_row)||jsonb_build_object('user_id',a))).*
      from public.assessment_answers assessment_row where assessment_row.user_id=c limit 1;
    perform pg_temp.assert_lineage('ancestor_remnant_seeded',exists(select 1 from public.assessment_answers where user_id=a));
    delete from kaq_private.account_merge_resume_heads where canonical_account_id=c;
    delete from kaq_private.account_merge_replay_heads where canonical_account_id=c;
    foreach table_name in array array[
      'learning_events','exam_responses','exam_sessions','fundamentals_unit_progress','fundamentals_final_sessions',
      'earned_certifications','assessment_answers','migration_items','migration_manifests','roadmap_profiles','dashboard_settings'
    ] loop
      execute format('delete from public.%I where user_id=$1',table_name) using c;
    end loop;
    perform kaq_private.advance_merge_lineage(remnant_receipt,c,b);
    raise exception 'lineage fixture: retired_ancestor_public_remnant accepted';
  exception when sqlstate 'PT409' then
    get stacked diagnostics actual_message = message_text;
    perform pg_temp.assert_lineage('retired_ancestor_public_remnant_message',actual_message='KAQ_MERGE_LINEAGE_DATA_REMAINS');
  end;
  perform pg_temp.assert_lineage('retired_ancestor_public_remnant_unchanged',pg_temp.lineage_fixture_state() is not distinct from before_state);
end $$;
rollback;
