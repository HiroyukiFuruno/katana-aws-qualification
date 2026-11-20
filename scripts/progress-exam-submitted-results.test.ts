import { expect, test } from 'bun:test';
import { createMemberExamRepository } from '../src/progress/examRepository';
import type { ProgressRpcClient } from '../src/progress/types';

test('submitted exam results load the latest submitted session without changing draft load', async () => {
  const queries: { table: string; filters?: Record<string, string> }[] = [];
  const client: ProgressRpcClient = {
    async rpc<T>(name: string) {
      if (name === 'read_learning_clock') return '2026-11-20T00:00:00Z' as T;
      throw new Error(`Unexpected RPC ${name}`);
    },
    async select<T>(table: string, filters?: Record<string, string>) {
      queries.push({ table, filters });
      if (table === 'exam_sessions')
        return [
          {
            certification_id: 'saa-c03',
            exam_id: 'older',
            state: 'submitted',
            submitted_at: '2026-11-19T00:00:00Z',
            started_at: '2026-11-18T00:00:00Z',
            deadline_at: '2026-11-18T01:00:00Z',
            position: 0,
            revision: 2,
            question_order: [{ question_id: 'q', question_revision: 1 }],
          },
          {
            certification_id: 'saa-c03',
            exam_id: 'latest',
            state: 'submitted',
            submitted_at: '2026-11-20T00:00:00Z',
            started_at: '2026-11-19T00:00:00Z',
            deadline_at: '2026-11-19T01:00:00Z',
            position: 0,
            revision: 4,
            question_order: [{ question_id: 'q', question_revision: 1 }],
          },
          {
            certification_id: 'saa-c03',
            exam_id: 'draft',
            state: 'draft',
            submitted_at: null,
            started_at: '2026-11-20T01:00:00Z',
            deadline_at: '2026-11-20T02:00:00Z',
            position: 0,
            revision: 1,
            question_order: [{ question_id: 'q', question_revision: 1 }],
          },
        ] as T;
      return [
        {
          exam_id: 'latest',
          question_key: '{"question_id":"q","question_revision":1}',
          selected: ['A'],
          flagged: true,
          duration_ms: 12,
          selected_at: '2026-11-20T00:00:00Z',
        },
      ] as T;
    },
  };
  const repository = createMemberExamRepository(
    client,
    () => 3,
    () => true,
  );
  const submitted = await repository.loadSubmitted('saa-c03');
  expect(submitted).toMatchObject({
    id: 'latest',
    submitted: true,
    revision: 4,
    responses: { '["q",1]': { selected: ['A'], flagged: true } },
  });
  expect(await repository.load('saa-c03')).toMatchObject({ id: 'draft' });
  expect(queries.map(({ table, filters }) => ({ table, filters }))).toEqual([
    { table: 'exam_sessions', filters: { certification_id: 'eq.saa-c03', state: 'eq.submitted' } },
    { table: 'exam_responses', filters: { exam_id: 'eq.latest' } },
    { table: 'exam_sessions', filters: { certification_id: 'eq.saa-c03', state: 'eq.draft' } },
    { table: 'exam_responses', filters: { exam_id: 'eq.draft' } },
  ]);
});

test('submitted results reject a late owner change after response read', async () => {
  let current = true;
  const repository = createMemberExamRepository(
    {
      rpc: async <T>(name: string) =>
        (name === 'read_learning_clock' ? '2026-11-20T00:00:00Z' : []) as T,
      select: async <T>(table: string) => {
        if (table === 'exam_responses') current = false;
        return (
          table === 'exam_sessions'
            ? [
                {
                  certification_id: 'saa-c03',
                  exam_id: 'e',
                  state: 'submitted',
                  submitted_at: '2026-11-20T00:00:00Z',
                  deadline_at: '2026-11-20T01:00:00Z',
                  position: 0,
                  revision: 1,
                  question_order: [{ question_id: 'q', question_revision: 1 }],
                },
              ]
            : []
        ) as T;
      },
    },
    () => 0,
    () => current,
  );
  await expect(repository.loadSubmitted('saa-c03')).rejects.toThrow('owner changed');
});
