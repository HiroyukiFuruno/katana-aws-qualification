-- 12表が非空の実seedと実OIDC userを使用。DDL/変更/原本を最後にrollbackする。
begin;
create temporary table snapshot_checks(name text primary key) on commit drop;
create function pg_temp.snapshot_assert(label text, passed boolean) returns void language plpgsql as $$
begin
  if passed is distinct from true then raise exception 'Snapshot assertion failed: %', label; end if;
  insert into snapshot_checks values(label);
end $$;
create function pg_temp.snapshot_reject(label text, statement text, expected text) returns void language plpgsql as $$
declare received text;
begin
  begin
    execute statement;
    raise exception 'Snapshot invalid input accepted: %', label;
  exception when others then
    get stacked diagnostics received = returned_sqlstate;
    if received <> expected then raise exception 'Snapshot % expected %, got %', label, expected, received; end if;
  end;
  insert into snapshot_checks values(label);
end $$;
do $$
declare
  seed_uid uuid := '__SEED_USER__'; first_uid uuid := '__FIRST_USER__';
  owners uuid[] := array[seed_uid, first_uid]; baseline jsonb; changed jsonb; expected jsonb;
  intent_id uuid := gen_random_uuid(); receipt_id uuid := gen_random_uuid();
  case_row record; table_name text; public_tables text[]; role_name text;
begin
  insert into kaq_private.learning_accounts(id) values(seed_uid), (first_uid);
  insert into kaq_private.learning_memberships(auth_user_id, account_id) values(seed_uid, seed_uid), (first_uid, first_uid);
  insert into kaq_private.account_intents(id, kind, actor_uid, actor_session_id, secret_hash,
    source_account_id, source_membership_epoch, state, expires_at)
    values(intent_id, 'merge_existing', seed_uid, gen_random_uuid(), decode(repeat('ab',32),'hex'), seed_uid, 0,
      'committed', clock_timestamp() + interval '5 minutes');
  insert into kaq_private.account_merge_receipts(id, intent_id, canonical_account_id, algorithm_version,
    consent_hash, before_scopes, choices, result)
    values(receipt_id, intent_id, seed_uid, 1, decode(repeat('ab',32),'hex'), '[]', '{}', '{}');
  insert into kaq_private.account_merge_archives(receipt_id, canonical_account_id, origin_account_id, table_name,
    row_key, row_key_hash, payload, payload_hash)
    values(receipt_id, seed_uid, first_uid, 'learning_events', '{"original":1}', decode(repeat('ab',32),'hex'),
      '{"retained":true}', decode(repeat('cd',32),'hex'));
  insert into kaq_private.account_merge_id_maps(receipt_id, canonical_account_id, origin_account_id, entity_kind,
    original_id, canonical_id, original_row_hash, canonical_row_hash)
    values(receipt_id, seed_uid, first_uid, 'event', gen_random_uuid(), gen_random_uuid(),
      decode(repeat('ab',32),'hex'), decode(repeat('cd',32),'hex'));
  baseline := kaq_private.capture_learning_snapshot(owners);
  perform pg_temp.snapshot_assert('stable_repeated_capture', kaq_private.capture_learning_snapshot(owners) = baseline);
  perform pg_temp.snapshot_assert('owner_order_canonical', kaq_private.capture_learning_snapshot(array[first_uid, seed_uid]) = baseline);
  perform pg_temp.snapshot_assert('complete_table_inventory', (select count(*) = 17 from jsonb_object_keys(baseline->'document'->'tables')));
  perform pg_temp.snapshot_assert('digest_uses_row_hash_collection', baseline->>'digest' =
    encode(extensions.digest((baseline->'fingerprints')::text, 'sha256'), 'hex'));
  perform set_config('TimeZone', 'Asia/Tokyo', true);
  perform set_config('DateStyle', 'German, DMY', true);
  perform pg_temp.snapshot_assert('caller_timezone_datestyle_invariant', kaq_private.capture_learning_snapshot(owners) = baseline);
  perform set_config('TimeZone', 'UTC', true);
  perform set_config('DateStyle', 'ISO, YMD', true);
  select array_agg(key order by key) into public_tables from jsonb_each(baseline->'document'->'tables')
    where key like 'public.%';
  foreach table_name in array public_tables loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C"), ''[]''::jsonb)
      from %s r where user_id = any($1)', table_name) into expected using owners;
    perform pg_temp.snapshot_assert('all_columns_and_rows_' || table_name,
      baseline->'document'->'tables'->table_name = expected and jsonb_array_length(expected) > 0);
    perform pg_temp.snapshot_assert('exact_row_count_' || table_name,
      (baseline->'fingerprints'->'tables'->table_name->>'count')::integer = jsonb_array_length(expected));
  end loop;
  for case_row in select * from (values
    ('learning_state', 'generation = generation + 1'),
    ('learning_events', 'duration_ms = duration_ms + 1'),
    ('exam_sessions', 'revision = revision + 1'),
    ('exam_responses', 'updated_at = updated_at + interval ''1 second'''),
    ('earned_certifications', 'recorded_at = recorded_at + interval ''1 second'''),
    ('assessment_answers', 'updated_at = updated_at + interval ''1 second'''),
    ('roadmap_profiles', 'revision = revision + 1'),
    ('migration_manifests', 'created_at = created_at + interval ''1 second'''),
    ('migration_items', 'reason_code = ''snapshot-changed'''),
    ('fundamentals_unit_progress', 'updated_at = updated_at + interval ''1 second'''),
    ('fundamentals_final_sessions', 'revision = revision + 1'),
    ('dashboard_settings', 'revision = revision + 1')
  ) mutations(relation, assignment) loop
    begin
      execute format('update public.%I set %s where user_id = $1', case_row.relation, case_row.assignment) using seed_uid;
      changed := kaq_private.capture_learning_snapshot(owners);
      if changed->>'digest' = baseline->>'digest' then raise exception 'Snapshot omitted table: %', case_row.relation; end if;
      raise sqlstate 'ZX001';
    exception when sqlstate 'ZX001' then null;
    end;
    perform pg_temp.snapshot_assert('mutation_detected_' || case_row.relation, kaq_private.capture_learning_snapshot(owners) = baseline);
  end loop;
  for case_row in select * from (values
    ('learning_accounts', 'id', 'membership_revision = membership_revision + 1'),
    ('learning_memberships', 'account_id', 'epoch = epoch + 1'),
    ('account_merge_receipts', 'canonical_account_id', 'choices = ''{"different":true}'''),
    ('account_merge_archives', 'canonical_account_id', 'payload = ''{"retained":false}'''),
    ('account_merge_id_maps', 'canonical_account_id', 'canonical_row_hash = decode(repeat(''ef'',32),''hex'')')
  ) mutations(relation, owner_column, assignment) loop
    begin
      execute format('update kaq_private.%I set %s where %I = $1', case_row.relation, case_row.assignment, case_row.owner_column) using seed_uid;
      if kaq_private.capture_learning_snapshot(owners)->>'digest' = baseline->>'digest' then
        raise exception 'Snapshot omitted private data: %', case_row.relation;
      end if;
      raise sqlstate 'ZX001';
    exception when sqlstate 'ZX001' then null;
    end;
    perform pg_temp.snapshot_assert('mutation_detected_' || case_row.relation, kaq_private.capture_learning_snapshot(owners) = baseline);
  end loop;
  perform pg_temp.snapshot_reject('null_scope', 'select kaq_private.capture_learning_snapshot(null)', '22023');
  perform pg_temp.snapshot_reject('empty_scope', 'select kaq_private.capture_learning_snapshot(array[]::uuid[])', '22023');
  perform pg_temp.snapshot_reject('null_member', 'select kaq_private.capture_learning_snapshot(array[null]::uuid[])', '22023');
  perform pg_temp.snapshot_reject('zero_member', 'select kaq_private.capture_learning_snapshot(array[''00000000-0000-0000-0000-000000000000'']::uuid[])', '22023');
  perform pg_temp.snapshot_reject('duplicate_owner', format('select kaq_private.capture_learning_snapshot(array[%L,%L]::uuid[])', seed_uid, seed_uid), '22023');
  perform pg_temp.snapshot_reject('unknown_owner', 'select kaq_private.capture_learning_snapshot(array[gen_random_uuid()])', 'PT409');
  perform pg_temp.snapshot_reject('multidimensional_scope', format('select kaq_private.capture_learning_snapshot(array[[%L]]::uuid[])', seed_uid), '22023');
  perform pg_temp.snapshot_reject('too_many_owners', format('select kaq_private.capture_learning_snapshot(array[%L,%L,gen_random_uuid()]::uuid[])', seed_uid, first_uid), '22023');
  begin
    delete from public.learning_state where user_id = seed_uid;
    perform pg_temp.snapshot_reject('missing_state', format('select kaq_private.capture_learning_snapshot(array[%L]::uuid[])', seed_uid), 'PT500');
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  insert into snapshot_checks values('missing_state');
  begin
    update kaq_private.learning_accounts set status = 'deleting' where id = seed_uid;
    perform pg_temp.snapshot_reject('inactive_account', format('select kaq_private.capture_learning_snapshot(array[%L]::uuid[])', seed_uid), 'PT409');
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  insert into snapshot_checks values('inactive_account');
  begin
    create table public.snapshot_canary_owner(user_id uuid);
    perform pg_temp.snapshot_reject('future_owner_table', format('select kaq_private.capture_learning_snapshot(array[%L]::uuid[])', seed_uid), 'PT500');
    raise sqlstate 'ZX001';
  exception when sqlstate 'ZX001' then null;
  end;
  insert into snapshot_checks values('future_owner_table');
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    perform pg_temp.snapshot_assert('owner_only_' || role_name,
      not has_function_privilege(role_name, 'kaq_private.capture_learning_snapshot(uuid[])', 'EXECUTE'));
  end loop;
end $$;
select json_build_object('status', 'passed', 'checks', json_agg(name order by name),
  'scope', 'private_single_statement_snapshot', 'publicApiExposed', false) from snapshot_checks;
rollback;
