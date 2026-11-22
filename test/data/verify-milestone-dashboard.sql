begin;

-- 予定ウィジェットは表示設定だけを検証する。完了予定を回答実績へ変換する検査は別の集計契約で扱う。
do $test$
begin
  if has_function_privilege('anon', 'public.dashboard_widget_compatible(text,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.dashboard_widget_compatible(text,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.dashboard_validate_settings(jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.dashboard_validate_settings(jsonb)', 'EXECUTE') then
    raise exception 'dashboard validation function permissions changed';
  end if;
end $test$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_a', 'role', 'authenticated')::text, true);
select set_config('kaq.test_user_a', :'user_a', true);
select public.initialize_learning_state();

do $test$
declare
  v_milestone_id uuid := 'e1111111-1111-4111-8111-111111111111';
  v_milestone jsonb;
  v_calendar jsonb := jsonb_build_object(
    'schemaVersion', 1,
    'filters', jsonb_build_object('period','30d','timezone','UTC','certificationIds',null,'categories',null,'modes',null,'contexts',null,'formats',null,'polarities',null,'revisions',null,'unitIds',null),
    'widgets', jsonb_build_array(jsonb_build_object(
      'id','milestones-1','kind','milestones','visible',true,'width','wide','chart','calendar','metric','answered','dimension','default',
      'overrides',jsonb_build_object('certificationIds',jsonb_build_array('saa-c03'),'timezone','Asia/Tokyo')
    ))
  );
  v_table jsonb := jsonb_set(v_calendar, '{widgets,0,chart}', '"table"'::jsonb);
  v_old jsonb := jsonb_build_object(
    'schemaVersion', 1,
    'filters', jsonb_build_object('period','30d','timezone','UTC','certificationIds',null,'categories',null,'modes',null,'contexts',null,'formats',null,'polarities',null,'revisions',null,'unitIds',null),
    'widgets', jsonb_build_array(
      jsonb_build_object('id','overview-1','kind','overview','visible',true,'width','wide','chart','metrics','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','trend-1','kind','trend','visible',true,'width','wide','chart','line','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','calendar-1','kind','calendar','visible',true,'width','wide','chart','heatmap','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','certifications-1','kind','certifications','visible',true,'width','normal','chart','bar','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','categories-1','kind','categories','visible',true,'width','normal','chart','radar','metric','accuracy','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','modes-1','kind','modes','visible',true,'width','normal','chart','donut','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','contexts-1','kind','contexts','visible',true,'width','normal','chart','donut','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','formats-1','kind','formats','visible',true,'width','normal','chart','bar','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','revisions-1','kind','revisions','visible',true,'width','normal','chart','bar','metric','answered','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','durations-1','kind','durations','visible',true,'width','normal','chart','histogram','metric','durationMs','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','relationship-1','kind','relationship','visible',true,'width','normal','chart','bubble','metric','meanDurationMs','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','reviews-1','kind','reviews','visible',true,'width','normal','chart','table','metric','incorrect','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','exams-1','kind','exams','visible',true,'width','wide','chart','table','metric','accuracy','dimension','default','overrides',jsonb_build_object()),
      jsonb_build_object('id','lessons-1','kind','lessons','visible',true,'width','wide','chart','table','metric','answered','dimension','default','overrides',jsonb_build_object())
    )
  );
begin
  v_milestone := public.save_certification_milestone(v_milestone_id, 'saa-c03', 'study', 'completed plan', '2027-06-01', null, true, null, 0);
  if v_milestone->>'revision' <> '0' then raise exception 'test milestone revision is wrong'; end if;
  if public.load_dashboard_settings(0) <> jsonb_build_object('revision',0,'settings',null) then raise exception 'initial dashboard settings are wrong'; end if;
  if public.save_dashboard_settings(v_calendar,0,0) <> jsonb_build_object('revision',1,'settings',v_calendar)
    or public.load_dashboard_settings(0) <> jsonb_build_object('revision',1,'settings',v_calendar) then
    raise exception 'milestone calendar settings did not save and load';
  end if;
  if public.save_site_preferences('ja','dark',0,0)->>'revision' <> '1'
    or public.load_dashboard_settings(0) <> jsonb_build_object('revision',1,'settings',v_calendar) then
    raise exception 'site preferences changed milestone dashboard settings';
  end if;
  if public.save_dashboard_settings(v_table,1,0)->>'revision' <> '2'
    or public.save_dashboard_settings(v_calendar,2,0)->>'revision' <> '3' then
    raise exception 'milestone calendar and table transition failed';
  end if;
  begin perform public.save_dashboard_settings(jsonb_set(v_calendar, '{widgets,0,overrides}', jsonb_build_object('period','30d')),3,0); raise exception 'milestone period override accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(jsonb_set(v_calendar, '{widgets,0,overrides}', jsonb_build_object('categories',jsonb_build_array('security'))),3,0); raise exception 'milestone category override accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(jsonb_set(v_calendar, '{widgets,0,overrides}', jsonb_build_object('modes',jsonb_build_array('study'))),3,0); raise exception 'milestone mode override accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(jsonb_set(v_calendar, '{widgets,0,metric}', '"correct"'::jsonb),3,0); raise exception 'milestone non-display metric accepted'; exception when sqlstate '22023' then null; end;
  begin perform public.save_dashboard_settings(jsonb_set(v_calendar, '{widgets,0,kind}', '"trend"'::jsonb),3,0); raise exception 'calendar chart accepted for another widget kind'; exception when sqlstate '22023' then null; end;
  if public.save_dashboard_settings(v_old,3,0)->>'revision' <> '4'
    or public.load_dashboard_settings(0) <> jsonb_build_object('revision',4,'settings',v_old) then
    raise exception 'existing dashboard widget settings are no longer compatible';
  end if;
  if public.save_dashboard_settings(v_old,3,0)->>'revision' <> '4' then raise exception 'dashboard settings retry changed revision'; end if;
  begin perform public.save_dashboard_settings(jsonb_set(v_old, '{widgets,0,visible}', 'false'::jsonb),3,0); raise exception 'stale dashboard settings overwrite accepted'; exception when sqlstate 'PT412' then null; end;
  if public.load_site_preferences(0) <> jsonb_build_object('locale','ja','theme','dark','revision',1) then
    raise exception 'dashboard settings changed site locale, theme, or revision';
  end if;
  if public.list_certification_milestones(0) <> jsonb_build_array(v_milestone) then
    raise exception 'dashboard settings changed planned milestone data or revision';
  end if;
end $test$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'user_b', 'role', 'authenticated')::text, true);
select set_config('kaq.test_user_b', :'user_b', true);
select public.initialize_learning_state();
do $test$
begin
  if public.load_dashboard_settings(0) <> jsonb_build_object('revision',0,'settings',null)
    or exists (select 1 from public.dashboard_settings where user_id = current_setting('kaq.test_user_a')::uuid)
    or public.list_certification_milestones(0) <> '[]'::jsonb then
    raise exception 'dashboard settings or milestones crossed the owner boundary';
  end if;
end $test$;

rollback;
