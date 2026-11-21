-- 終端後でも暗号文を消せるよう、正規の文脈とrevisionだけを返す owner 専用経路。
create function kaq_private.runtime_cleanup_revision(p_leg_id uuid, guard jsonb) returns bigint
language plpgsql volatile security definer set search_path = pg_catalog, kaq_private
as $$
declare
  intent kaq_private.account_intents%rowtype;
  leg kaq_private.account_proof_legs%rowtype;
  runtime kaq_private.account_proof_runtime%rowtype;
  expiry timestamptz;
begin
  select * into intent from kaq_private.account_intents
    where id = (select intent_id from kaq_private.account_proof_legs where id = p_leg_id)
    for update;
  if not found then return null; end if;
  select * into leg from kaq_private.account_proof_legs where id = p_leg_id for update;
  if not found then return null; end if;
  select * into runtime from kaq_private.account_proof_runtime where leg_id = p_leg_id for update;
  if not found then return null; end if;
  expiry := case runtime.phase when 'leg' then leg.expires_at else intent.expires_at end;
  if runtime.phase is distinct from guard->>'purpose'
    or runtime.expires_at is distinct from expiry
    or not kaq_private.runtime_guard_matches(guard, intent, leg, runtime.phase) then return null; end if;
  return runtime.revision;
end $$;

revoke all on function kaq_private.runtime_cleanup_revision(uuid,jsonb)
  from public, anon, authenticated, service_role;
