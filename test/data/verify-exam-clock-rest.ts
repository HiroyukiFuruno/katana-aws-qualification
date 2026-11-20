import { randomUUID } from 'node:crypto';

type AuthSession = { access_token: string; user: { id: string } };
type Request = (
  path: string,
  options?: { body?: object; method?: string; token?: string },
) => Promise<Response>;
type Confirmed = { duration_ms: number; revision: number; selected_at: string | null };

function payload(
  examId: string,
  revision: number,
  selectionMade: boolean,
  selected: string[],
  durationMs: number,
) {
  return {
    p_duration_ms: durationMs,
    p_exam_id: examId,
    p_expected_generation: 0,
    p_expected_revision: revision,
    p_flagged: !selectionMade,
    p_position: 0,
    p_question_ref: { question_id: 'confirmed-http', question_revision: 1 },
    p_response_position: 0,
    p_selected: selected,
    p_selection_made: selectionMade,
  };
}

async function confirmed(request: Request, token: string, body: object) {
  const response = await request('/rpc/save_exam_response_confirmed', { body, method: 'POST', token });
  return { response, rows: (await response.json()) as Confirmed[] };
}

export async function verifyConfirmedExamPostgrest(
  request: Request,
  first: AuthSession,
  second: AuthSession,
) {
  const clock = await request('/rpc/read_learning_clock', {
    body: { p_expected_generation: 0 },
    method: 'POST',
    token: first.access_token,
  });
  if (!clock.ok || typeof (await clock.json()) !== 'string')
    throw new Error('PostgREST did not return the authenticated server clock');

  const examId = randomUUID();
  const questionRef = { question_id: 'confirmed-http', question_revision: 1 };
  const start = await request('/rpc/start_exam_session', {
    body: {
      p_duration_ms: 60_000,
      p_exam_id: examId,
      p_expected_generation: 0,
      p_question_order: [questionRef],
      p_certification_id: 'saa-c03',
      p_source_version: '2026-11',
    },
    method: 'POST',
    token: first.access_token,
  });
  if (!start.ok) throw new Error(`PostgREST could not start a confirmed exam: ${await start.text()}`);

  const firstSave = await confirmed(request, first.access_token, payload(examId, 0, true, ['A'], 7));
  const saved = firstSave.rows[0];
  if (
    !firstSave.response.ok ||
    saved?.revision !== 1 ||
    saved.duration_ms !== 7 ||
    !saved.selected_at?.includes('T')
  )
    throw new Error('PostgREST did not preserve the confirmed response timestamp');

  const repeat = await confirmed(request, first.access_token, payload(examId, 1, true, ['A'], 7));
  if (!repeat.response.ok || repeat.rows[0]?.selected_at !== saved.selected_at)
    throw new Error('PostgREST changed a confirmed timestamp without a selection change');

  const flagOnly = await confirmed(request, first.access_token, payload(examId, 2, false, [], 0));
  if (
    !flagOnly.response.ok ||
    flagOnly.rows[0]?.selected_at !== null ||
    flagOnly.rows[0]?.duration_ms !== 0
  )
    throw new Error('PostgREST did not preserve an unanswered flagged response');

  const stale = await confirmed(request, first.access_token, {
    ...payload(examId, 3, false, [], 0),
    p_expected_generation: 1,
  });
  if (stale.response.ok || stale.response.status !== 409)
    throw new Error('PostgREST accepted a stale confirmed response');

  const secondState = await request('/rpc/initialize_learning_state', {
    body: {},
    method: 'POST',
    token: second.access_token,
  });
  if (!secondState.ok) throw new Error('PostgREST could not initialize the second user');
  const other = await confirmed(request, second.access_token, payload(examId, 3, false, [], 0));
  if (other.response.ok) throw new Error('PostgREST let another user write a confirmed response');

  const anonymousClock = await request('/rpc/read_learning_clock', {
    body: { p_expected_generation: 0 },
    method: 'POST',
  });
  if (anonymousClock.ok) throw new Error('PostgREST allowed anonymous clock access');
}
