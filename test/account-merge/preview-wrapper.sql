-- test 専用の署名済み境界。private raw snapshot と識別子を持つ scope を意図的に除去する。
create function public.fixture_prepare_account_merge_preview(
  p_intent_id uuid, p_intent_secret text, p_expected_revision bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare pack jsonb; failure_code text; failure_message text;
begin
  pack := kaq_private.prepare_account_merge_preview(p_intent_id, p_intent_secret, p_expected_revision);
  return jsonb_build_object('preview_id', pack->'preview_id', 'revision', pack->'revision',
    'digest', pack->'digest', 'expires_at', pack->'expires_at',
    'existing_account_count', pack->'existing_account_count', 'membership_count', pack->'membership_count');
exception when others then
  get stacked diagnostics failure_code = returned_sqlstate, failure_message = message_text;
  if failure_message like 'KAQ#_%' escape '#' then
    raise exception using errcode = failure_code, message = failure_message;
  end if;
  raise exception using errcode = 'PT500', message = 'KAQ_PREVIEW_UNEXPECTED';
end $$;
revoke all on function public.fixture_prepare_account_merge_preview(uuid,text,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.fixture_prepare_account_merge_preview(uuid,text,bigint) to authenticated;

notify pgrst, 'reload schema';
