-- #60 の予定は学習実績と分離し、本人の予定だけをRPC経由で保存する。
create table public.certification_milestones (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  certification_id text not null check (certification_id in (
    'clf-c02', 'aif-c01', 'saa-c03', 'dva-c03', 'soa-c03', 'dea-c01', 'mla-c01',
    'sap-c03', 'dop-c02', 'aip-c01', 'scs-c03', 'ans-c01', 'ai-business-strategist'
  )),
  kind text not null check (kind in ('target', 'study', 'mock_exam', 'exam')),
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  planned_on date,
  planned_at timestamptz,
  completed boolean not null,
  revision bigint not null default 0 check (revision >= 0),
  primary key (user_id, id),
  check (
    (kind = 'target' and planned_on is not null and planned_on between date '0001-01-01' and date '9999-12-31' and planned_at is null and not completed)
    or (kind <> 'target' and ((planned_on is not null and planned_on between date '0001-01-01' and date '9999-12-31' and planned_at is null)
      or (planned_on is null and planned_at is not null and planned_at >= timestamptz '0001-01-01 00:00:00+00'
        and planned_at < timestamptz '10000-01-01 00:00:00+00')))
  )
);
create unique index certification_milestones_one_target_idx
  on public.certification_milestones(user_id, certification_id) where kind = 'target';

alter table public.certification_milestones enable row level security;
create policy certification_milestones_read on public.certification_milestones
  for select to authenticated using (user_id = auth.uid());
revoke all on table public.certification_milestones from public, anon, authenticated, service_role;
grant select on table public.certification_milestones to authenticated;

create function public.certification_milestone_json(p_row public.certification_milestones)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_row.id, 'certificationId', p_row.certification_id, 'kind', p_row.kind,
    'title', p_row.title, 'plannedOn', p_row.planned_on, 'plannedAt', p_row.planned_at,
    'completed', p_row.completed, 'revision', p_row.revision
  );
$$;

create function public.list_certification_milestones(p_expected_generation bigint)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation);
begin
  return coalesce((select jsonb_agg(public.certification_milestone_json(m) order by m.planned_on nulls last, m.planned_at nulls last, m.id)
    from public.certification_milestones m where m.user_id = v_user_id), '[]'::jsonb);
end $$;

create function public.save_certification_milestone(
  p_id uuid, p_certification_id text, p_kind text, p_title text, p_planned_on date,
  p_planned_at timestamptz, p_completed boolean, p_expected_revision bigint, p_expected_generation bigint
) returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_trimmed_title text := btrim(p_title, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
  v_row public.certification_milestones%rowtype;
begin
  if p_id is null or p_certification_id is null or p_certification_id not in (
    'clf-c02', 'aif-c01', 'saa-c03', 'dva-c03', 'soa-c03', 'dea-c01', 'mla-c01',
    'sap-c03', 'dop-c02', 'aip-c01', 'scs-c03', 'ans-c01', 'ai-business-strategist'
  ) or p_kind is null or p_kind not in ('target', 'study', 'mock_exam', 'exam') or p_title is null
    or p_title <> v_trimmed_title or char_length(v_trimmed_title) not between 1 and 120 or p_completed is null
    or (p_expected_revision is not null and p_expected_revision < 0)
    or (p_kind = 'target' and (p_planned_on is null or p_planned_on not between date '0001-01-01' and date '9999-12-31'
      or p_planned_at is not null or p_completed))
    or (p_kind <> 'target' and not ((p_planned_on is not null and p_planned_on between date '0001-01-01' and date '9999-12-31' and p_planned_at is null)
      or (p_planned_on is null and p_planned_at is not null and p_planned_at >= timestamptz '0001-01-01 00:00:00+00'
        and p_planned_at < timestamptz '10000-01-01 00:00:00+00'))) then
    raise exception 'invalid certification milestone' using errcode = '22023';
  end if;
  select * into v_row from public.certification_milestones
    where user_id = v_user_id and id = p_id for update;
  if found then
    if (v_row.certification_id, v_row.kind, v_row.title, v_row.planned_on, v_row.planned_at, v_row.completed)
      is not distinct from (p_certification_id, p_kind, p_title, p_planned_on, p_planned_at, p_completed) then
      return public.certification_milestone_json(v_row);
    end if;
    if p_expected_revision is null or p_expected_revision < 0 or v_row.revision <> p_expected_revision then
      raise exception 'stale certification milestone' using errcode = 'PT412';
    end if;
    update public.certification_milestones set certification_id = p_certification_id, kind = p_kind,
      title = p_title, planned_on = p_planned_on, planned_at = p_planned_at, completed = p_completed,
      revision = revision + 1 where user_id = v_user_id and id = p_id returning * into v_row;
    return public.certification_milestone_json(v_row);
  end if;
  if p_expected_revision is not null then raise exception 'stale certification milestone' using errcode = 'PT412'; end if;
  begin
    insert into public.certification_milestones(
      user_id, id, certification_id, kind, title, planned_on, planned_at, completed
    ) values (v_user_id, p_id, p_certification_id, p_kind, p_title, p_planned_on, p_planned_at, p_completed)
    on conflict (user_id, id) do nothing returning * into v_row;
  exception when unique_violation then
    raise exception 'certification target already exists' using errcode = '23505';
  end;
  if not found then
    select * into v_row from public.certification_milestones
      where user_id = v_user_id and id = p_id for update;
    if found and (v_row.certification_id, v_row.kind, v_row.title, v_row.planned_on, v_row.planned_at, v_row.completed)
      is not distinct from (p_certification_id, p_kind, p_title, p_planned_on, p_planned_at, p_completed) then
      return public.certification_milestone_json(v_row);
    end if;
    if found then raise exception 'stale certification milestone' using errcode = 'PT412'; end if;
    raise exception 'certification target already exists' using errcode = '23505';
  end if;
  return public.certification_milestone_json(v_row);
end $$;

create function public.delete_certification_milestone(
  p_id uuid, p_expected_revision bigint, p_expected_generation bigint
) returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_generation(p_expected_generation); v_revision bigint;
begin
  if p_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid certification milestone revision' using errcode = '22023';
  end if;
  select revision into v_revision from public.certification_milestones
    where user_id = v_user_id and id = p_id for update;
  if not found then return true; end if;
  if v_revision <> p_expected_revision then
    raise exception 'stale certification milestone' using errcode = 'PT412';
  end if;
  delete from public.certification_milestones where user_id = v_user_id and id = p_id;
  return true;
end $$;

revoke all on function public.certification_milestone_json(public.certification_milestones),
  public.list_certification_milestones(bigint),
  public.save_certification_milestone(uuid,text,text,text,date,timestamptz,boolean,bigint,bigint),
  public.delete_certification_milestone(uuid,bigint,bigint) from public, anon, authenticated, service_role;
grant execute on function public.list_certification_milestones(bigint),
  public.save_certification_milestone(uuid,text,text,text,date,timestamptz,boolean,bigint,bigint),
  public.delete_certification_milestone(uuid,bigint,bigint) to authenticated;
