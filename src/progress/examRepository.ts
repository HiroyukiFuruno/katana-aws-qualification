import type { ExamDraft, ExamResponse } from '../exam';
import type { ExamFinalizationEvent } from './examFinalization';
import type { ProgressRpcClient } from './types';

type SessionRow = {
  certification_id: string;
  state: string;
  deadline_at: string;
  exam_id: string;
  question_order: QuestionRef[];
  revision: number;
  position: number;
};
type ResponseRow = {
  exam_id: string;
  question_key: string;
  selected: string[];
  flagged: boolean;
  duration_ms: number;
  selected_at: string | null;
};
type QuestionRef = { question_id: string; question_revision: number };

function refs(order: string[]) {
  return order.map((key) => {
    const value: unknown = JSON.parse(key);
    if (!Array.isArray(value) || typeof value[0] !== 'string' || !Number.isInteger(value[1]))
      throw new Error('Invalid exam question key');
    return { question_id: value[0], question_revision: value[1] };
  });
}

function key(ref: QuestionRef) {
  return JSON.stringify([ref.question_id, ref.question_revision]);
}

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
  return {
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
      if (!isCurrent()) throw new Error('Progress owner changed');
      const responses: Record<string, ExamResponse> = {};
      for (const row of rows.filter((item) => item.exam_id === session.exam_id))
        responses[row.question_key] = {
          selected: row.selected,
          flagged: row.flagged,
          durationMs: row.duration_ms,
          ...(row.selected_at ? { selectedAt: Date.parse(row.selected_at) } : {}),
        };
      return {
        id: session.exam_id,
        deadline: Date.parse(session.deadline_at),
        order: session.question_order.map(key),
        position: session.position,
        responses,
        revision: session.revision,
      };
    },
    async start(draft: ExamDraft, certificationId: string, sourceVersion: string, durationMs: number) {
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
      return { ...draft, deadline: Date.parse(result.deadline_at), revision: result.revision };
    },
    async save(draft: ExamDraft, position: number, questionKey: string, response: ExamResponse) {
      const revision = await rpc<number>('save_exam_response', {
        p_exam_id: draft.id,
        p_expected_revision: draft.revision ?? 0,
        p_position: position,
        p_question_ref: refs([questionKey])[0],
        p_selected: response.selected,
        p_flagged: response.flagged,
        p_duration_ms: response.durationMs,
        p_selected_at: response.selectedAt ? new Date(response.selectedAt).toISOString() : null,
      });
      return {
        ...draft,
        position,
        revision,
        responses: { ...draft.responses, [questionKey]: response },
      };
    },
    finalize: (draft: ExamDraft, events: ExamFinalizationEvent[]) =>
      rpc<string>('finalize_exam_session', {
        p_exam_id: draft.id,
        p_expected_revision: draft.revision ?? 0,
        p_events: events.map((event) => {
          const response =
            draft.responses[
              key({ question_id: event.question_id, question_revision: event.question_revision })
            ];
          return {
            ...event,
            flagged: response?.flagged ?? false,
            selected_at: response?.selectedAt ? new Date(response.selectedAt).toISOString() : null,
          };
        }),
      }),
  };
}
