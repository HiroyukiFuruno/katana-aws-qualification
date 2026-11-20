import type { ExamDraft } from '../exam';
import { createExamClock } from '../examClock';
import {
  questionKey,
  type ResponseRow,
  type SessionRow,
  storedQuestionKey,
} from './examRepositoryCodec';
import type { ProgressRpcClient } from './types';

export type SubmittedExamDraft = ExamDraft & { submitted: true };

export async function readExamSession(
  client: ProgressRpcClient,
  readClock: () => Promise<string>,
  isCurrent: () => boolean,
  session: SessionRow,
  submitted = false,
): Promise<ExamDraft | SubmittedExamDraft> {
  const rows = await client.select<ResponseRow[]>('exam_responses', {
    exam_id: `eq.${session.exam_id}`,
  });
  const serverISO = await readClock();
  if (!isCurrent()) throw new Error('Progress owner changed');
  const responses: Record<string, ExamDraft['responses'][string]> = {};
  for (const row of rows.filter((item) => item.exam_id === session.exam_id)) {
    responses[storedQuestionKey(row.question_key)] = {
      selected: row.selected,
      flagged: row.flagged,
      durationMs: row.duration_ms,
      ...(row.selected_at
        ? { selectedAt: Date.parse(row.selected_at), selectedAtUtc: row.selected_at }
        : {}),
    };
  }
  const draft = {
    clock: createExamClock(serverISO),
    id: session.exam_id,
    deadline: Date.parse(session.deadline_at),
    order: session.question_order.map(questionKey),
    position: session.position,
    responses,
    revision: session.revision,
  } satisfies ExamDraft;
  return submitted ? { ...draft, submitted: true } : draft;
}
