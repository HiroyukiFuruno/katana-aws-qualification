-- Native fixture専用。production/public RPCではない。
create function public.fixture_claim_account_delete_job()
returns table(job_id uuid, lease_id uuid) language sql security definer
set search_path = pg_catalog, kaq_private
as $$ select * from kaq_private.claim_account_delete_job() $$;

create function public.fixture_next_account_delete_target(p_lease_id uuid)
returns table(auth_uid uuid, is_anchor boolean, remaining_non_anchor integer) language sql security definer
set search_path = pg_catalog, kaq_private
as $$ select * from kaq_private.next_account_delete_target(p_lease_id) $$;

create function public.fixture_confirm_account_delete_target_absent(p_lease_id uuid, p_auth_uid uuid)
returns boolean language sql security definer set search_path = pg_catalog, kaq_private
as $$ select kaq_private.confirm_account_delete_target_absent(p_lease_id, p_auth_uid) $$;

create function public.fixture_defer_account_delete_job(p_lease_id uuid, p_reason text)
returns void language sql security definer set search_path = pg_catalog, kaq_private
as $$ select kaq_private.defer_account_delete_job(p_lease_id, p_reason) $$;

create function public.fixture_complete_account_delete_job(p_lease_id uuid)
returns boolean language sql security definer set search_path = pg_catalog, kaq_private
as $$ select kaq_private.complete_account_delete_job(p_lease_id) $$;

create function public.fixture_read_account_delete_receipt(p_receipt_id uuid)
returns text language sql security definer set search_path = pg_catalog, kaq_private
as $$ select kaq_private.read_account_delete_receipt(p_receipt_id) $$;

revoke all on function public.fixture_claim_account_delete_job(),
  public.fixture_next_account_delete_target(uuid), public.fixture_confirm_account_delete_target_absent(uuid,uuid),
  public.fixture_defer_account_delete_job(uuid,text), public.fixture_complete_account_delete_job(uuid),
  public.fixture_read_account_delete_receipt(uuid) from public, anon, authenticated;
grant execute on function public.fixture_claim_account_delete_job(),
  public.fixture_next_account_delete_target(uuid), public.fixture_confirm_account_delete_target_absent(uuid,uuid),
  public.fixture_defer_account_delete_job(uuid,text), public.fixture_complete_account_delete_job(uuid),
  public.fixture_read_account_delete_receipt(uuid) to service_role;
