import type { ExamDraft, ExamResponse } from '../exam';
import { createExamClock } from '../examClock';
import type { ExamFinalizationEvent } from './examFinalization';
import {
  questionKey,
  type ResponseRow,
  refs,
  type SessionRow,
  storedQuestionKey,
} from './examRepositoryCodec';
import type { ProgressRpcClient } from './types';

type ConfirmedResponse = { duration_ms: number; revision: number; selected_at: string | null };

export function createMemberExamRepository(
  client: ProgressRpcClient,
  getGeneration: () => number,
  isCurrent: () => boolean,
) {
  async function rpc<T>(name: string, args: Record<string, unknown>) {
    if (!isCurrent()) throw new Error('Progress owner changed');
    const result = await client.rpc<T>(name, { ...args, p_expected_generation: getGeneration() });
    if (!isCurrent()) throw new Error('Progress owner changed');
    return result;
  }
  const readClock = () => rpc<string>('read_learning_clock', {});
  return {
    readClock,
    async load(certificationId: string): Promise<ExamDraft | undefined> {
      if (!isCurrent()) throw new Error('Progress owner changed');
      const sessions = await client.select<SessionRow[]>('exam_sessions', {
        certification_id: `eq.${certificationId}`,
        state: 'eq.draft',
      });
      const session = sessions.findLast(
        (item) => item.certification_id === certificationId && item.state === 'draft',
      );
      if (!session) return undefined;
      const rows = await client.select<ResponseRow[]>('exam_responses', {
        exam_id: `eq.${session.exam_id}`,
      });
      const serverISO = await readClock();
      if (!isCurrent()) throw new Error('Progress owner changed');
      const responses: Record<string, ExamResponse> = {};
      for (const row of rows.filter((item) => item.exam_id === session.exam_id))
        responses[storedQuestionKey(row.question_key)] = {
          selected: row.selected,
          flagged: row.flagged,
          durationMs: row.duration_ms,
          ...(row.selected_at
            ? { selectedAt: Date.parse(row.selected_at), selectedAtUtc: row.selected_at }
            : {}),
        };
      return {
        clock: createExamClock(serverISO),
        id: session.exam_id,
        deadline: Date.parse(session.deadline_at),
        order: session.question_order.map(questionKey),
        position: session.position,
        responses,
        revision: session.revision,
      };
    },
    async start(draft: ExamDraft, certificationId: string, sourceVersion: string, durationMs: number) {
      const clock = createExamClock(await readClock());
      const rows = await rpc<{ exam_id: string; deadline_at: string; revision: number }[]>(
        'start_exam_session',
        {
          p_exam_id: draft.id,
          p_certification_id: certificationId,
          p_source_version: sourceVersion,
          p_question_order: refs(draft.order),
          p_duration_ms: durationMs,
        },
      );
      const result = rows.find((row) => row.exam_id === draft.id);
      if (!result) throw new Error('Exam start response is invalid');
      return { ...draft, clock, deadline: Date.parse(result.deadline_at), revision: result.revision };
    },
    async save(draft: ExamDraft, position: number, responseKey: string, response: ExamResponse) {
      const responsePosition = draft.order.indexOf(responseKey);
      if (responsePosition < 0) throw new Error('Exam response is not in the draft.');
      const [confirmed] = await rpc<ConfirmedResponse[]>('save_exam_response_confirmed', {
        p_exam_id: draft.id,
        p_expected_revision: draft.revision ?? 0,
        p_position: position,
        p_response_position: responsePosition,
        p_question_ref: refs([responseKey])[0],
        p_selected: response.selected,
        p_flagged: response.flagged,
        p_duration_ms: Math.max(0, Math.round(response.durationMs)),
        p_selection_made: response.selectedAt !== undefined,
      });
      if (!confirmed) throw new Error('Confirmed exam response is invalid.');
      const { selectedAt: _selectedAt, selectedAtUtc: _selectedAtUtc, ...current } = response;
      const savedResponse = {
        ...current,
        durationMs: confirmed.duration_ms,
        ...(confirmed.selected_at
          ? { selectedAt: Date.parse(confirmed.selected_at), selectedAtUtc: confirmed.selected_at }
          : {}),
      };
      return {
        ...draft,
        position,
        revision: confirmed.revision,
        responses: { ...draft.responses, [responseKey]: savedResponse },
      };
    },
    finalize: (draft: ExamDraft, events: ExamFinalizationEvent[]) =>
      rpc<string>('finalize_exam_session', {
        p_exam_id: draft.id,
        p_expected_revision: draft.revision ?? 0,
        p_events: events.map((event) => {
          const response =
            draft.responses[
              questionKey({ question_id: event.question_id, question_revision: event.question_revision })
            ];
          return {
            ...event,
            flagged: response?.flagged ?? false,
            selected_at: response?.selectedAtUtc ?? null,
          };
        }),
      }),
  };
}
