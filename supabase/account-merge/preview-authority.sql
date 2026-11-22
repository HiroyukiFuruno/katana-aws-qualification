-- #58 の preview authority source のみ。production migration と HTTP route は意図的に含めない。
create function kaq_private.prepare_account_merge_preview(
  p_intent_id uuid, p_intent_secret text, p_expected_revision bigint
) returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public, kaq_private, extensions
set timezone = 'UTC'
set datestyle = 'ISO, YMD'
set bytea_output = 'hex'
as $$
declare
  scope jsonb; account_ids uuid[]; materialized jsonb; intent kaq_private.account_intents%rowtype;
  v_preview_expires_at timestamptz; next_preview_id uuid; combined jsonb; digest text;
begin
  -- actor、intent、proof、account、membership、grant、state の lock はこの一回だけ取得する。
  scope := kaq_private.lock_account_intent_scope(p_intent_id, p_intent_secret, p_expected_revision);
  select array_agg(value::uuid order by value::uuid) into account_ids
    from jsonb_array_elements_text(scope->'existing_account_ids') value;
  if cardinality(account_ids) not between 1 and 2 then
    raise exception using errcode = 'PT409', message = 'KAQ_PREVIEW_SCOPE_INVALID';
  end if;
  select * into strict intent from kaq_private.account_intents where id = p_intent_id for update;
  if intent.revision <> p_expected_revision or intent.state not in ('both_proved','previewed') then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_STALE';
  end if;

  -- 一つの SELECT で combined full-v2 snapshot と既存 owner ごとの source snapshot を materialize する。
  with input as materialized (select account_ids ids),
  combined_snapshot as materialized (
    select kaq_private.capture_merge_snapshot_v2(ids) snapshot from input
  ), per_source as materialized (
    select account_id, kaq_private.capture_merge_snapshot_v2(array[account_id]) snapshot
      from input cross join lateral unnest(ids) account_id
  )
  select jsonb_build_object('combined', (select snapshot from combined_snapshot), 'sources',
    (select jsonb_object_agg(account_id::text, snapshot order by account_id) from per_source)) into materialized;
  combined := materialized->'combined';
  digest := combined->>'digest';
  if digest is null or digest !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'PT500', message = 'KAQ_PREVIEW_DIGEST_INVALID';
  end if;
  select least(intent.expires_at, clock_timestamp() + interval '2 minutes', coalesce(min(least(proof.expires_at, leg.expires_at)), intent.expires_at))
    into v_preview_expires_at from kaq_private.account_proofs proof
    join kaq_private.account_proof_legs leg on leg.id = proof.leg_id
    where proof.intent_id = intent.id and leg.side in ('source','target');
  if v_preview_expires_at <= clock_timestamp() then
    raise exception using errcode = 'PT409', message = 'KAQ_INTENT_EXPIRED';
  end if;
  next_preview_id := gen_random_uuid();
  update kaq_private.account_intents set preview_id = next_preview_id, preview_digest = decode(digest, 'hex'),
    preview_document = jsonb_build_object('algorithm_version', 2, 'scope', scope, 'snapshots', materialized),
    preview_expires_at = v_preview_expires_at, state = 'previewed', revision = revision + 1
    where id = intent.id and revision = p_expected_revision;
  if not found then raise exception using errcode = 'PT409', message = 'KAQ_INTENT_STALE'; end if;
  return jsonb_build_object('preview_id', next_preview_id, 'revision', p_expected_revision + 1,
    'digest', digest, 'expires_at', v_preview_expires_at, 'existing_account_count', cardinality(account_ids),
    'membership_count', scope->'membership_count', 'scope', scope, 'document', materialized);
end $$;
revoke all on function kaq_private.prepare_account_merge_preview(uuid,text,bigint)
  from public, anon, authenticated, service_role;
