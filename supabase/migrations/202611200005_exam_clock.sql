-- 端末時計のずれを持ち込まず、既存v1の厳密な回答検査を維持する。
create or replace function public.read_learning_clock(p_expected_generation bigint)
returns timestamptz
language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.require_learning_generation(p_expected_generation);
  return clock_timestamp();
end $$;

create or replace function public.save_exam_response_confirmed(
  p_exam_id uuid, p_expected_generation bigint, p_expected_revision bigint, p_position integer,
  p_response_position integer, p_question_ref jsonb, p_selected jsonb, p_flagged boolean,
  p_duration_ms integer, p_selection_made boolean
) returns table(revision bigint, selected_at timestamptz, duration_ms integer)
language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id uuid := public.require_learning_generation(p_expected_generation);
  v_session public.exam_sessions%rowtype;
  v_previous public.exam_responses%rowtype;
  v_selected_at timestamptz;
  v_revision bigint;
begin
  if p_selection_made is null then
    raise exception 'selection state is required' using errcode = '22023';
  end if;
  select * into v_session from public.exam_sessions
    where user_id = v_user_id and exam_id = p_exam_id and state = 'draft' for update;
  if not found or p_position not between 0 and jsonb_array_length(v_session.question_order) - 1
    or p_response_position not between 0 and jsonb_array_length(v_session.question_order) - 1 then
    raise exception 'invalid confirmed exam position' using errcode = '22023';
  end if;
  if p_selection_made then
    select * into v_previous from public.exam_responses
      where user_id = v_user_id and exam_id = p_exam_id and question_key = p_question_ref::text for update;
    if found and v_previous.selected is not distinct from p_selected and v_previous.selected_at is not null then
      v_selected_at := v_previous.selected_at;
    else
      v_selected_at := clock_timestamp();
    end if;
  end if;
  v_revision := public.save_exam_response(
    p_exam_id, p_expected_generation, p_expected_revision, p_response_position, p_question_ref,
    p_selected, p_flagged, p_duration_ms, v_selected_at
  );
  update public.exam_sessions set position = p_position
    where user_id = v_user_id and exam_id = p_exam_id;
  return query
    select v_revision, response.selected_at, response.duration_ms
    from public.exam_responses response
    where response.user_id = v_user_id and response.exam_id = p_exam_id and response.question_key = p_question_ref::text;
end $$;

revoke all on function public.read_learning_clock(bigint),
  public.save_exam_response_confirmed(uuid, bigint, bigint, integer, integer, jsonb, jsonb, boolean, integer, boolean) from public, anon;
grant execute on function public.read_learning_clock(bigint),
  public.save_exam_response_confirmed(uuid, bigint, bigint, integer, integer, jsonb, jsonb, boolean, integer, boolean) to authenticated;
