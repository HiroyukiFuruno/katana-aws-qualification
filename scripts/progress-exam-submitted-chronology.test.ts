import { expect, test } from 'bun:test';
import { createMemberExamRepository } from '../src/progress/examRepository';
import type { ProgressRpcClient } from '../src/progress/types';

test('migrated submitted sessions use exam event chronology over dated sessions', async () => {
  const client: ProgressRpcClient = {
    async rpc<T>(name: string) {
      if (name === 'read_learning_clock') return '2026-11-20T00:00:00Z' as T;
      throw new Error(`Unexpected RPC ${name}`);
    },
    async select<T>(table: string) {
      if (table === 'exam_sessions')
        return [
          {
            certification_id: 'saa-c03',
            exam_id: 'z-migrated',
            state: 'submitted',
            submitted_at: null,
            started_at: null,
            deadline_at: '2026-11-01T00:00:00Z',
            position: 0,
            revision: 1,
            question_order: [{ question_id: 'q', question_revision: 1 }],
          },
          {
            certification_id: 'saa-c03',
            exam_id: 'a-member',
            state: 'submitted',
            submitted_at: '2026-11-19T00:00:00Z',
            started_at: '2026-11-18T00:00:00Z',
            deadline_at: '2026-11-20T00:00:00Z',
            position: 0,
            revision: 1,
            question_order: [{ question_id: 'q', question_revision: 1 }],
          },
        ] as T;
      if (table === 'learning_events')
        return [
          {
            certification_id: 'saa-c03',
            exam_id: 'z-migrated',
            mode: 'exam',
            answered_at: '2026-11-20T00:00:00Z',
          },
        ] as T;
      return [
        {
          exam_id: 'z-migrated',
          question_key: '{"question_id":"q","question_revision":1}',
          selected: ['A'],
          flagged: false,
          duration_ms: 1,
          selected_at: null,
        },
      ] as T;
    },
  };
  const repository = createMemberExamRepository(
    client,
    () => 0,
    () => true,
  );
  await expect(repository.loadSubmitted('saa-c03')).resolves.toMatchObject({
    id: 'z-migrated',
    submitted: true,
  });
});
