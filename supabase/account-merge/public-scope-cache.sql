-- 未登録。top-level public writerがstate modeを先に確定し、内部append等の再入だけ同一scopeで共有する。
create function kaq_private.open_public_learning_scope(p_state_mode text, p_expected_generation bigint)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, auth, public, kaq_private
as $$
declare context jsonb; cached jsonb; scope jsonb; current_grant jsonb; generation bigint; raw_cache text;
begin
  if p_state_mode is null or p_state_mode not in ('writer','reset')
    or p_expected_generation is null or p_expected_generation < 0 then
    raise exception using errcode = 'PT400', message = 'KAQ_SCOPE_ARGUMENT_INVALID';
  end if;
  context := kaq_private.lock_request_context();
  raw_cache := nullif(current_setting('kaq.public_learning_scope', true), '');
  if raw_cache is not null then
    begin
      cached := raw_cache::jsonb;
    exception when invalid_text_representation then
      raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_CACHE_INVALID';
    end;
    if jsonb_typeof(cached) is distinct from 'object' or cached->'schema_version' is distinct from '1'::jsonb
      or jsonb_typeof(cached->'scope') is distinct from 'object'
      or jsonb_typeof(cached->'context') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(cached)) <> 4
      or exists(select 1 from jsonb_object_keys(cached) name where name not in ('schema_version','scope','context','txid'))
      or cached->>'txid' is distinct from pg_current_xact_id()::text
      or cached->'context' is distinct from context then
      raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_CACHE_INVALID';
    end if;
    scope := cached->'scope';
    if scope->>'state_mode' is null or (scope->>'state_mode' is distinct from p_state_mode
      and not (scope->>'state_mode' = 'reset' and p_state_mode = 'writer')) then
      raise exception using errcode = 'PT409', message = 'KAQ_SCOPE_MODE_UPGRADE';
    end if;
    current_grant := kaq_private.resolve_current_learning_grant();
    if (scope->>'actor_uid')::uuid is distinct from (context->>'actor_uid')::uuid
      or (scope->>'session_id')::uuid is distinct from (context->>'session_id')::uuid
      or (scope->>'account_id')::uuid is distinct from (current_grant->>'account_id')::uuid
      or (scope->>'membership_epoch')::bigint is distinct from (current_grant->>'membership_epoch')::bigint then
      raise exception using errcode = 'PT403', message = 'KAQ_SCOPE_INVALID';
    end if;
    select state.generation into generation from public.learning_state state
      where state.user_id = (scope->>'account_id')::uuid;
    if not found or generation is distinct from p_expected_generation
      or (scope->>'generation')::bigint is distinct from p_expected_generation then
      raise exception using errcode = 'PT409', message = 'KAQ_GENERATION_STALE';
    end if;
    return scope;
  end if;
  scope := kaq_private.lock_learning_scope(p_state_mode, p_expected_generation);
  perform set_config('kaq.public_learning_scope', jsonb_build_object('schema_version',1,
    'txid',pg_current_xact_id()::text,'context',context,'scope',scope)::text, true);
  return scope;
end $$;
revoke all on function kaq_private.open_public_learning_scope(text,bigint) from public, anon, authenticated, service_role;
