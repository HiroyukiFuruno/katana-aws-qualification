import { expect, test } from 'bun:test';
import { createMemberExamRepository, type ProgressRpcClient } from '../src/progress';
import { ExamFinalizationCache } from '../src/progress/examFinalization';
import type { Question } from '../src/questions';

const question: Question = {
  category: 'storage',
  choices: [{ explanation: 'Correct', id: 'a', text: 'A' }],
  correct: ['a'],
  id: 'q',
  prompt: 'Prompt',
  revision: 1,
  source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
  title: 'Title',
  version: '2026-11',
};

test('exam writes include generation, revision, and the immutable question reference', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      return name === 'start_exam_session'
        ? [{ exam_id: 'e', deadline_at: '2026-12-01T00:00:00Z', revision: 2 }]
        : 3;
    },
    async select() {
      return [];
    },
  };
  const repo = createMemberExamRepository(
    client,
    () => 7,
    () => true,
  );
  const draft = await repo.start(
    { id: 'e', deadline: 0, order: ['["q",1]'], position: 0, responses: {} },
    'saa-c03',
    'v1',
    60000,
  );
  const saved = await repo.save(draft, 0, '["q",1]', {
    durationMs: 2,
    flagged: false,
    selected: ['a'],
  });
  const finalization = new ExamFinalizationCache().getOrCreate([], 'saa-c03', saved, [question], 0);
  await repo.finalize(saved, finalization.events);
  expect(calls[0]).toMatchObject({
    name: 'start_exam_session',
    args: { p_expected_generation: 7, p_question_order: [{ question_id: 'q', question_revision: 1 }] },
  });
  expect(calls[1]).toMatchObject({
    name: 'save_exam_response',
    args: {
      p_expected_generation: 7,
      p_expected_revision: 2,
      p_question_ref: { question_id: 'q', question_revision: 1 },
    },
  });
  expect(calls[2]).toMatchObject({
    name: 'finalize_exam_session',
    args: {
      p_events: finalization.events.map((event) => ({ ...event, flagged: false, selected_at: null })),
      p_expected_generation: 7,
      p_expected_revision: 3,
    },
  });
});

test('an owner switch rejects results after an RPC completes', async () => {
  let current = true;
  const repo = createMemberExamRepository(
    {
      rpc: async () => {
        current = false;
        return { deadline_at: '2026-12-01T00:00:00Z', revision: 1 };
      },
      select: async () => [],
    },
    () => 0,
    () => current,
  );
  await expect(
    repo.start(
      { id: 'e', deadline: 0, order: ['["q",1]'], position: 0, responses: {} },
      'saa',
      'v',
      60000,
    ),
  ).rejects.toThrow('owner changed');
});

test('exam finalization keeps an immutable event payload for a retry', () => {
  const draft = {
    deadline: 1_000,
    id: '00000000-0000-0000-0000-000000000001',
    order: ['["q",1]'],
    position: 0,
    responses: { '["q",1]': { durationMs: 50, flagged: false, selected: ['a'], selectedAt: 800 } },
    revision: 4,
  };
  const cache = new ExamFinalizationCache();
  const first = cache.getOrCreate([], 'saa-c03', draft, [question], 900);
  const retry = cache.getOrCreate([], 'saa-c03', draft, [question], 1_000);
  expect(retry).toBe(first);
  expect(first.events).toEqual([
    expect.objectContaining({
      answered_at: '1970-01-01T00:00:00.800Z',
      certification_id: 'saa-c03',
      exam_id: draft.id,
      mode: 'exam',
      question_id: 'q',
      question_revision: 1,
      source_version: '2026-11',
    }),
  ]);
  expect(retry.events[0].event_id).toBe(first.events[0].event_id);
});
