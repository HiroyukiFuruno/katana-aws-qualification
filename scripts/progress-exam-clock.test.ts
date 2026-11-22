import { expect, test } from 'bun:test';
import { createMemberExamRepository, type ProgressRpcClient } from '../src/progress';
import { ExamFinalizationCache } from '../src/progress/examFinalization';
import { examQuestion } from './progress-store-fixture';

const selectedAt = '2026-11-20T00:00:00.123456+00:00';

test('member exam load normalizes stored question refs and preserves confirmed UTC selection time', async () => {
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'read_learning_clock') return selectedAt;
      throw new Error(`Unexpected RPC ${name}`);
    },
    async select(table) {
      if (table === 'exam_sessions')
        return [
          {
            certification_id: 'saa-c03',
            deadline_at: '2026-11-20T01:00:00+00:00',
            exam_id: 'exam',
            position: 1,
            question_order: [{ question_id: 'q', question_revision: 1 }],
            revision: 2,
            state: 'draft',
          },
        ];
      return [
        {
          duration_ms: 11,
          exam_id: 'exam',
          flagged: true,
          question_key: JSON.stringify({ question_id: 'q', question_revision: 1 }),
          selected: ['a'],
          selected_at: selectedAt,
        },
      ];
    },
  };
  const repo = createMemberExamRepository(
    client,
    () => 4,
    () => true,
  );
  const draft = await repo.load('saa-c03');

  expect(draft).toMatchObject({
    clock: { serverTime: Date.parse(selectedAt) },
    order: ['["q",1]'],
    responses: {
      '["q",1]': { flagged: true, selected: ['a'], selectedAtUtc: selectedAt },
    },
  });
});

test('confirmed saves use the server timestamp in the finalization payload', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'read_learning_clock') return selectedAt;
      if (name === 'start_exam_session_v2')
        return [{ exam_id: 'exam', deadline_at: '2026-11-20T01:00:00+00:00', revision: 2 }];
      if (name === 'save_exam_response_confirmed')
        return [{ duration_ms: 19, revision: 3, selected_at: selectedAt }];
      if (name === 'finalize_exam_session') return 'exam';
      throw new Error(`Unexpected RPC ${name}`);
    },
    async select() {
      return [];
    },
  };
  const repo = createMemberExamRepository(
    client,
    () => 4,
    () => true,
  );
  const started = await repo.start(
    { id: 'exam', deadline: 0, order: ['["q",1]'], position: 0, responses: {} },
    'saa-c03',
    'v1',
    60_000,
  );
  const saved = await repo.save(started, 1, '["q",1]', {
    durationMs: 10.7,
    flagged: true,
    selected: ['a'],
    selectedAt: 1,
  });
  const finalization = new ExamFinalizationCache().getOrCreate([], 'saa-c03', saved, [examQuestion], 0);
  await repo.finalize(saved, finalization.events);

  expect(calls.find((call) => call.name === 'save_exam_response_confirmed')).toMatchObject({
    args: { p_duration_ms: 11, p_position: 1, p_response_position: 0, p_selection_made: true },
  });
  expect(finalization.events[0]).toMatchObject({ answered_at: selectedAt });
  expect(calls.find((call) => call.name === 'finalize_exam_session')).toMatchObject({
    args: { p_events: [expect.objectContaining({ selected_at: selectedAt })] },
  });
});
