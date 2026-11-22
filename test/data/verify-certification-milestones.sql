begin;

do $test$
begin
  if has_function_privilege('anon', 'public.list_certification_milestones(bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.save_certification_milestone(uuid,text,text,text,date,timestamptz,boolean,bigint,bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.delete_certification_milestone(uuid,bigint,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.list_certification_milestones(bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.save_certification_milestone(uuid,text,text,text,date,timestamptz,boolean,bigint,bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.delete_certification_milestone(uuid,bigint,bigint)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.certification_milestone_json(public.certification_milestones)', 'EXECUTE') then
    raise exception 'milestone RPC permissions are incorrect';
  end if;
end $test$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
select public.initialize_learning_state();

do $test$
declare v_id uuid := 'd1111111-1111-4111-8111-111111111111'; v_row jsonb;
begin
  v_row := public.save_certification_milestone(v_id, 'saa-c03', 'target', 'Goal', '2027-06-01', null, false, null, 0);
  if v_row <> jsonb_build_object('id',v_id,'certificationId','saa-c03','kind','target','title','Goal','plannedOn','2027-06-01','plannedAt',null,'completed',false,'revision',0)
    or (select count(*) from jsonb_object_keys(v_row)) <> 8 then raise exception 'target response is not the strict milestone contract'; end if;
  if public.save_certification_milestone(v_id, 'saa-c03', 'target', 'Goal', '2027-06-01', null, false, null, 0) <> v_row then
    raise exception 'new milestone retry was not idempotent';
  end if;
  begin insert into public.certification_milestones(user_id,id,certification_id,kind,title,planned_on,completed) values (auth.uid(),pg_catalog.gen_random_uuid(),'saa-c03','target','bypass','2027-07-01',false); raise exception 'direct milestone write accepted'; exception when insufficient_privilege then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','target','bad','2027-07-01','2027-07-01T00:00:00Z',false,null,0); raise exception 'target instant accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','study','bad',null,null,false,null,0); raise exception 'undated schedule accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'missing','study','bad','2027-07-01',null,false,null,0); raise exception 'unknown catalog ID accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','study','bad','infinity',null,false,null,0); raise exception 'infinite date accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','study','bad','10000-01-01',null,false,null,0); raise exception 'out-of-range date accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','study','bad',null,'infinity',false,null,0); raise exception 'infinite instant accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','study',' title ','2027-07-01',null,false,null,0); raise exception 'untrimmed title accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','study','bad','2027-07-01',null,false,-1,0); raise exception 'negative save revision accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_certification_milestone(pg_catalog.gen_random_uuid(),'saa-c03','study','bad','2027-07-01',null,false,0,0); raise exception 'missing update accepted'; exception when sqlstate 'PT412' then null; end;
  begin perform public.delete_certification_milestone(pg_catalog.gen_random_uuid(),null,0); raise exception 'null delete revision accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.delete_certification_milestone(pg_catalog.gen_random_uuid(),-1,0); raise exception 'negative delete revision accepted'; exception when sqlstate '22023' then null; end;
  perform public.reset_my_learning_data(0);
  if public.list_certification_milestones(1) <> jsonb_build_array(v_row) then raise exception 'learning reset removed milestones'; end if;
  begin perform public.list_certification_milestones(0); raise exception 'stale milestone generation accepted'; exception when sqlstate 'PT409' then null; end;
end $test$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_b', 'role', 'authenticated')::text, true);
select set_config('kaq.test_user_b', :'user_b', true);
select public.initialize_learning_state();
do $test$
begin
  if public.list_certification_milestones(0) <> '[]'::jsonb then raise exception 'milestone RLS leaked another owner'; end if;
  if not public.delete_certification_milestone('d1111111-1111-4111-8111-111111111111', 0, 0) then raise exception 'missing delete was not idempotent'; end if;
  perform public.save_certification_milestone('d3333333-3333-4333-8333-333333333333', 'clf-c02', 'target', 'cascade', '2027-08-01', null, false, null, 0);
end $test$;

reset role;
delete from auth.users where id = :'user_b';
do $test$
begin
  if exists (select 1 from public.certification_milestones where user_id = current_setting('kaq.test_user_b')::uuid) then raise exception 'account deletion did not cascade milestones'; end if;
end $test$;

rollback;
