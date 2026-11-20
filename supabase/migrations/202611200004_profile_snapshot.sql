-- A profile read is one statement so its values share one MVCC snapshot.
create or replace function public.load_roadmap_profile_snapshot()
returns table(earned jsonb, answers jsonb, revision bigint)
language plpgsql stable security definer set search_path = public, auth as $$
declare v_user_id uuid := public.require_learning_user();
begin
  return query select
    coalesce((select jsonb_agg(e.certification_id order by e.certification_id)
      from public.earned_certifications e where e.user_id = v_user_id), '[]'::jsonb),
    coalesce((select jsonb_object_agg(a.assessment_id, a.answer order by a.assessment_id)
      from public.assessment_answers a where a.user_id = v_user_id), '{}'::jsonb),
    coalesce((select p.revision from public.roadmap_profiles p where p.user_id = v_user_id), 0);
end $$;

revoke all on function public.load_roadmap_profile_snapshot() from public, anon;
grant execute on function public.load_roadmap_profile_snapshot() to authenticated;
