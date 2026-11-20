import { expect, test } from 'bun:test';
import { createMemberExamRepository } from '../src/progress/examRepository';
import type { ProgressRpcClient } from '../src/progress/types';

test('exam resume selects only the requested certification draft and its responses', async () => {
  const queries: { table: string; filters?: Record<string, string> }[] = [];
  const session = {
    deadline_at: '2026-12-01T00:00:00Z',
    position: 0,
    question_order: [{ question_id: 'q', question_revision: 1 }],
    revision: 3,
  };
  const client: ProgressRpcClient = {
    async rpc<T>(): Promise<T> {
      throw new Error('Unexpected write');
    },
    async select<T>(table: string, filters?: Record<string, string>): Promise<T> {
      queries.push({ table, filters });
      const rows =
        table === 'exam_sessions'
          ? [
              { ...session, certification_id: 'other', exam_id: 'wrong-course', state: 'draft' },
              { ...session, certification_id: 'saa-c03', exam_id: 'submitted', state: 'submitted' },
              { ...session, certification_id: 'saa-c03', exam_id: 'correct-draft', state: 'draft' },
            ]
          : [
              {
                exam_id: 'correct-draft',
                question_key: '["q",1]',
                selected: ['A'],
                flagged: false,
                duration_ms: 100,
                selected_at: null,
              },
              {
                exam_id: 'wrong-course',
                question_key: '["q",1]',
                selected: ['B'],
                flagged: true,
                duration_ms: 999,
                selected_at: null,
              },
            ];
      return rows as T;
    },
  };
  const repository = createMemberExamRepository(
    client,
    () => 0,
    () => true,
  );
  const draft = await repository.load('saa-c03');
  expect(draft?.id).toBe('correct-draft');
  expect(draft?.responses['["q",1]'].selected).toEqual(['A']);
  expect(queries).toEqual([
    { table: 'exam_sessions', filters: { certification_id: 'eq.saa-c03', state: 'eq.draft' } },
    { table: 'exam_responses', filters: { exam_id: 'eq.correct-draft' } },
  ]);
});

test('an empty start RPC table response is rejected instead of creating an invalid deadline', async () => {
  const repository = createMemberExamRepository(
    { rpc: async <T>() => [] as T, select: async <T>() => [] as T },
    () => 0,
    () => true,
  );
  await expect(
    repository.start(
      { id: 'missing', deadline: 0, order: ['["q",1]'], position: 0, responses: {} },
      'saa-c03',
      'v1',
      60000,
    ),
  ).rejects.toThrow('start response is invalid');
});
