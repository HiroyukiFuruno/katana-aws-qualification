-- 暗号文の正本はlegに束縛する。時刻をJSONへ返す際はJS安全なDB millisecondへ切り下げる。
create function kaq_private.runtime_epoch_ms(value timestamptz) returns bigint
language sql immutable strict set search_path = pg_catalog
as $$ select floor(extract(epoch from value) * 1000)::bigint $$;

create function kaq_private.runtime_active(state text) returns boolean
language sql immutable set search_path = pg_catalog
as $$ select coalesce(state in ('awaiting_source','awaiting_target','both_proved','previewed'),false) $$;

create function kaq_private.runtime_guard_matches(
  guard jsonb, intent kaq_private.account_intents, leg kaq_private.account_proof_legs, expected_phase text
) returns boolean language plpgsql stable security definer
set search_path = pg_catalog, kaq_private
as $$
begin
  return coalesce(jsonb_typeof(guard) = 'object'
    and guard ?& array['purpose','intentId','legId','attempt','storageKey','issuedAt','expiresAt']
    and jsonb_typeof(guard->'purpose') = 'string' and jsonb_typeof(guard->'intentId') = 'string'
    and jsonb_typeof(guard->'legId') = 'string' and jsonb_typeof(guard->'attempt') = 'number'
    and jsonb_typeof(guard->'storageKey') = 'string' and jsonb_typeof(guard->'issuedAt') = 'number'
    and jsonb_typeof(guard->'expiresAt') = 'number'
    and guard->>'purpose' = expected_phase
    and guard->>'intentId' = intent.id::text
    and guard->>'legId' = leg.id::text
    and guard->>'attempt' ~ '^[1-3]$' and (guard->>'attempt')::integer = leg.attempt
    and guard->>'storageKey' = leg.storage_key
    and guard->>'issuedAt' ~ '^[1-9][0-9]{0,15}$' and (length(guard->>'issuedAt')<16 or guard->>'issuedAt'<='9007199254740991') and (guard->>'issuedAt')::bigint = kaq_private.runtime_epoch_ms(leg.issued_at)
    and guard->>'expiresAt' ~ '^[1-9][0-9]{0,15}$' and (length(guard->>'expiresAt')<16 or guard->>'expiresAt'<='9007199254740991') and (guard->>'expiresAt')::bigint =
      kaq_private.runtime_epoch_ms(case expected_phase when 'leg' then leg.expires_at else intent.expires_at end),false);
end $$;

create function kaq_private.runtime_next_valid(next_record jsonb, expected_revision bigint, expected_expiry timestamptz)
returns boolean language plpgsql stable security definer set search_path = pg_catalog, kaq_private
as $$
declare next_revision bigint; next_expiry bigint;
begin
  if coalesce(jsonb_typeof(next_record) <> 'object'
    or not (next_record ?& array['revision','keyVersion','nonce','ciphertext','expiresAt'])
    or jsonb_typeof(next_record->'revision') <> 'number' or jsonb_typeof(next_record->'keyVersion') <> 'string'
    or jsonb_typeof(next_record->'nonce') <> 'string' or jsonb_typeof(next_record->'ciphertext') <> 'string'
    or jsonb_typeof(next_record->'expiresAt') <> 'number'
    or next_record->>'revision' !~ '^(0|[1-9][0-9]{0,18})$'
    or length(next_record->>'revision') > 16
    or (length(next_record->>'revision')=16 and next_record->>'revision' > '9007199254740991')
    or next_record->>'expiresAt' !~ '^[1-9][0-9]{0,15}$'
    or (length(next_record->>'expiresAt')=16 and next_record->>'expiresAt' > '9007199254740991')
    or next_record->>'keyVersion' !~ '^[A-Za-z0-9._-]{1,64}$'
    or next_record->>'nonce' !~ '^[0-9A-Fa-f]{24}$'
    or next_record->>'ciphertext' !~ '^[0-9A-Fa-f]{32,}$'
    or length(next_record->>'ciphertext') % 2 <> 0,false) then return false; end if;
  next_revision := (next_record->>'revision')::bigint;
  next_expiry := (next_record->>'expiresAt')::bigint;
  return coalesce(next_revision = expected_revision and next_expiry = kaq_private.runtime_epoch_ms(expected_expiry),false);
end $$;

create function kaq_private.runtime_read(p_leg_id uuid, guard jsonb) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype; runtime kaq_private.account_proof_runtime%rowtype;
begin
  select * into intent from kaq_private.account_intents where id=(select intent_id from kaq_private.account_proof_legs where id=p_leg_id) for update;
  if not found then return null; end if;
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id for update;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=p_leg_id for update;
  if not found or not kaq_private.runtime_guard_matches(guard,intent,leg,coalesce(guard->>'purpose','')) then return null; end if;
  if runtime.phase is distinct from guard->>'purpose'
    or runtime.expires_at is distinct from (case runtime.phase when 'leg' then leg.expires_at else intent.expires_at end)
    or not kaq_private.runtime_active(intent.state)
    or (runtime.phase='leg' and leg.state not in ('issued','exchanging'))
    or (runtime.phase='proof' and leg.state not in ('exchanged','proved'))
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(intent.expires_at)
    or (runtime.phase='leg' and kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(leg.expires_at)) then return null; end if;
  return jsonb_build_object('revision',runtime.revision,'keyVersion',runtime.encryption_key_version,
    'nonce',encode(runtime.nonce,'hex'),'ciphertext',encode(runtime.ciphertext,'hex'),
    'expiresAt',kaq_private.runtime_epoch_ms(runtime.expires_at));
end $$;

create function kaq_private.runtime_is_terminal(p_leg_id uuid, guard jsonb) returns boolean
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype; runtime kaq_private.account_proof_runtime%rowtype;
begin
  select * into intent from kaq_private.account_intents where id=(select intent_id from kaq_private.account_proof_legs where id=p_leg_id) for update;
  if not found then return true; end if;
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id for update;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=p_leg_id for update;
  if not found then
    return not coalesce(guard->>'purpose'='leg' and kaq_private.runtime_guard_matches(guard,intent,leg,'leg')
      and kaq_private.runtime_active(intent.state) and leg.state in ('issued','exchanging')
      and kaq_private.runtime_epoch_ms(clock_timestamp()) < kaq_private.runtime_epoch_ms(intent.expires_at)
      and kaq_private.runtime_epoch_ms(clock_timestamp()) < kaq_private.runtime_epoch_ms(leg.expires_at),false);
  end if;
  if not kaq_private.runtime_guard_matches(guard,intent,leg,coalesce(guard->>'purpose',''))
    or runtime.phase is distinct from guard->>'purpose' then return true; end if;
  return not kaq_private.runtime_active(intent.state)
    or (runtime.phase='leg' and leg.state not in ('issued','exchanging'))
    or (runtime.phase='proof' and leg.state not in ('exchanged','proved'))
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(intent.expires_at)
    or (runtime.phase='leg' and kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(leg.expires_at));
end $$;

create function kaq_private.runtime_compare_and_swap(p_leg_id uuid, expected_revision bigint, next_record jsonb, guard jsonb)
returns boolean language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype; runtime kaq_private.account_proof_runtime%rowtype; expiry timestamptz; current_revision bigint;
begin
  select * into intent from kaq_private.account_intents where id=(select intent_id from kaq_private.account_proof_legs where id=p_leg_id) for update;
  if not found then return false; end if;
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id for update;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=p_leg_id for update;
  if runtime.leg_id is null then
    if expected_revision is not null or (guard->>'purpose') is distinct from 'leg' then return false; end if;
    current_revision := -1; expiry := leg.expires_at;
  else
    current_revision := runtime.revision; expiry := case runtime.phase when 'leg' then leg.expires_at else intent.expires_at end;
    if runtime.phase is distinct from guard->>'purpose' or runtime.expires_at is distinct from expiry then return false; end if;
  end if;
  if not kaq_private.runtime_guard_matches(guard,intent,leg,guard->>'purpose')
    or not kaq_private.runtime_active(intent.state)
    or (guard->>'purpose'='leg' and leg.state not in ('issued','exchanging'))
    or (guard->>'purpose'='proof' and leg.state not in ('exchanged','proved'))
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(intent.expires_at)
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(expiry)
    or expected_revision is distinct from nullif(current_revision,-1)
    or current_revision > 9007199254740991
    or not kaq_private.runtime_next_valid(next_record,current_revision+1,expiry) then return false; end if;
  if runtime.leg_id is null then
    insert into kaq_private.account_proof_runtime(leg_id,revision,encryption_key_version,nonce,ciphertext,expires_at,phase)
      values(leg.id,current_revision+1,next_record->>'keyVersion',decode(next_record->>'nonce','hex'),decode(next_record->>'ciphertext','hex'),expiry,guard->>'purpose');
  else
    update kaq_private.account_proof_runtime set revision=current_revision+1,encryption_key_version=next_record->>'keyVersion',
      nonce=decode(next_record->>'nonce','hex'),ciphertext=decode(next_record->>'ciphertext','hex'),expires_at=expiry,updated_at=clock_timestamp()
      where leg_id=leg.id and revision=current_revision;
    if not found then return false; end if;
  end if;
  return true;
end $$;

create function kaq_private.runtime_delete_if_revision(p_leg_id uuid, expected_revision bigint, guard jsonb)
returns text language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype; runtime kaq_private.account_proof_runtime%rowtype; expiry timestamptz;
begin
  select * into intent from kaq_private.account_intents where id=(select intent_id from kaq_private.account_proof_legs where id=p_leg_id) for update;
  if not found then return 'missing'; end if;
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id for update;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=p_leg_id for update;
  if not found then return 'missing'; end if;
  expiry := case runtime.phase when 'leg' then leg.expires_at else intent.expires_at end;
  if expected_revision is distinct from runtime.revision or runtime.phase is distinct from guard->>'purpose'
    or runtime.expires_at is distinct from expiry or not kaq_private.runtime_guard_matches(guard,intent,leg,runtime.phase) then return 'conflict'; end if;
  delete from kaq_private.account_proof_runtime where leg_id=leg.id and revision=expected_revision;
  return case when found then 'deleted' else 'conflict' end;
end $$;

create function kaq_private.runtime_promote_proof(p_leg_id uuid, expected_leg_revision bigint, leg_guard jsonb, proof_guard jsonb, next_record jsonb)
returns boolean language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare intent kaq_private.account_intents%rowtype; leg kaq_private.account_proof_legs%rowtype; runtime kaq_private.account_proof_runtime%rowtype;
begin
  select * into intent from kaq_private.account_intents where id=(select intent_id from kaq_private.account_proof_legs where id=p_leg_id) for update;
  if not found then return false; end if;
  select * into leg from kaq_private.account_proof_legs where id=p_leg_id for update;
  select * into runtime from kaq_private.account_proof_runtime where leg_id=p_leg_id for update;
  if not found or runtime.phase is distinct from 'leg' or expected_leg_revision is null or expected_leg_revision < 0
    or leg.revision is distinct from expected_leg_revision or leg.state is distinct from 'exchanging'
    or not kaq_private.runtime_active(intent.state)
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(intent.expires_at)
    or kaq_private.runtime_epoch_ms(clock_timestamp()) >= kaq_private.runtime_epoch_ms(leg.expires_at)
    or runtime.revision > 9007199254740991 or runtime.expires_at is distinct from leg.expires_at or not kaq_private.runtime_guard_matches(leg_guard,intent,leg,'leg')
    or not kaq_private.runtime_guard_matches(proof_guard,intent,leg,'proof')
    or not kaq_private.runtime_next_valid(next_record,runtime.revision+1,intent.expires_at) then return false; end if;
  update kaq_private.account_proof_runtime set phase='proof',revision=runtime.revision+1,encryption_key_version=next_record->>'keyVersion',
    nonce=decode(next_record->>'nonce','hex'),ciphertext=decode(next_record->>'ciphertext','hex'),expires_at=intent.expires_at,updated_at=clock_timestamp()
    where leg_id=leg.id and revision=runtime.revision and phase='leg';
  if not found then return false; end if;
  update kaq_private.account_proof_legs set state='exchanged',revision=revision+1 where id=leg.id and state='exchanging' and revision=expected_leg_revision;
  return found;
end $$;

revoke all on function kaq_private.runtime_epoch_ms(timestamptz), kaq_private.runtime_active(text),
  kaq_private.runtime_guard_matches(jsonb,kaq_private.account_intents,kaq_private.account_proof_legs,text),
  kaq_private.runtime_next_valid(jsonb,bigint,timestamptz), kaq_private.runtime_read(uuid,jsonb),
  kaq_private.runtime_is_terminal(uuid,jsonb), kaq_private.runtime_compare_and_swap(uuid,bigint,jsonb,jsonb),
  kaq_private.runtime_delete_if_revision(uuid,bigint,jsonb), kaq_private.runtime_promote_proof(uuid,bigint,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
