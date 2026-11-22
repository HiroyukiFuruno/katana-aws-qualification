begin;

do $test$
begin
  if has_function_privilege('anon', 'public.load_site_preferences(bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.save_site_preferences(text,text,bigint,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.load_site_preferences(bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.save_site_preferences(text,text,bigint,bigint)', 'EXECUTE') then
    raise exception 'site preference RPC permissions are incorrect';
  end if;
end $test$;

insert into auth.users (id, email) values
  ('c1111111-1111-4111-8111-111111111111', 'site-preferences@example.test');
insert into public.learning_state(user_id, generation) values
  ('c1111111-1111-4111-8111-111111111111', 0);

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub','c1111111-1111-4111-8111-111111111111','role','authenticated')::text, true);

do $test$
declare
  v_user_id uuid := 'c1111111-1111-4111-8111-111111111111';
  v_layout jsonb := jsonb_build_object(
    'schemaVersion', 1,
    'filters', jsonb_build_object('period','30d','timezone','UTC','certificationIds',null,'categories',null,'modes',null,'contexts',null,'formats',null,'polarities',null,'revisions',null,'unitIds',null),
    'widgets', jsonb_build_array(jsonb_build_object('id','trend-1','kind','trend','visible',true,'width','wide','chart','line','metric','answered','dimension','default','overrides',jsonb_build_object()))
  );
begin
  if public.load_site_preferences(0) <> jsonb_build_object('locale',null,'theme',null,'revision',0) then
    raise exception 'initial site preferences are wrong';
  end if;
  if public.save_site_preferences('ja','dark',0,0) <> jsonb_build_object('locale','ja','theme','dark','revision',1)
    or public.save_site_preferences('ja','dark',0,0)->>'revision' <> '1' then
    raise exception 'site preference retry is not idempotent';
  end if;
  begin update public.dashboard_settings set site_theme = 'light' where user_id = v_user_id; raise exception 'direct site preference update accepted'; exception when insufficient_privilege then null; end;
  begin perform public.save_site_preferences('en-US','dark',1,0); raise exception 'invalid locale accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_site_preferences('ja','system',1,0); raise exception 'invalid theme accepted'; exception when sqlstate '22023' then null; end;
  if public.save_dashboard_settings(v_layout,0,0)->>'revision' <> '1' then raise exception 'dashboard layout save failed'; end if;
  if public.save_site_preferences('fr','light',1,0)->>'revision' <> '2' then raise exception 'site preference revision did not advance'; end if;
  if public.load_dashboard_settings(0) <> jsonb_build_object('revision',1,'settings',v_layout) then
    raise exception 'site preference save changed dashboard layout';
  end if;
  perform public.reset_my_learning_data(0);
  if public.load_site_preferences(1) <> jsonb_build_object('locale','fr','theme','light','revision',2) then
    raise exception 'learning reset removed site preferences';
  end if;
  begin perform public.load_site_preferences(0); raise exception 'stale site preference generation accepted'; exception when sqlstate 'PT409' then null; end;
end $test$;

reset role;
delete from auth.users where id = 'c1111111-1111-4111-8111-111111111111';
do $test$
begin
  if exists (select 1 from public.dashboard_settings where user_id = 'c1111111-1111-4111-8111-111111111111') then
    raise exception 'account deletion did not cascade site preferences';
  end if;
end $test$;

rollback;
