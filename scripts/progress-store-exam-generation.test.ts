import { expect, test } from 'bun:test';
import type { ExamDraft, ExamResponse } from '../src/exam';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import { ProgressApiError } from '../src/progress/api';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import { memberAttempt, memoryStorage } from './progress-store-fixture';

type Boundary = 'clock' | 'finalize' | 'load' | 'save' | 'start';
type Call = { generation: number; name: string };

const owner = { kind: 'member' as const, generation: 0, userId: 'member-a' };
const key = '["q",1]';
const draft: ExamDraft = {
  deadline: Date.now() + 60_000,
  id: '10000000-0000-0000-0000-000000000001',
  order: [key],
  position: 0,
  responses: {},
  revision: 0,
};
const response: ExamResponse = { durationMs: 0, flagged: false, selected: [] };

function clientFor(
  boundary: Boundary,
  calls: Call[],
  server: { generation: number },
): ProgressRpcClient {
  const failingRpc = {
    clock: 'read_learning_clock',
    finalize: 'finalize_exam_session',
    load: 'read_learning_clock',
    save: 'save_exam_response_confirmed',
    start: 'start_exam_session',
  }[boundary];
  return {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return server.generation;
      if (name === 'load_roadmap_profile_snapshot') return [];
      const generation = args.p_expected_generation as number;
      calls.push({ generation, name });
      if (name === failingRpc && generation !== server.generation)
        throw new ProgressApiError(409, 'PT409');
      if (name === 'read_learning_clock') return '2026-11-20T00:00:00.000Z';
      if (name === 'start_exam_session')
        return [{ deadline_at: '2026-11-20T00:01:00.000Z', exam_id: draft.id, revision: 0 }];
      if (name === 'save_exam_response_confirmed')
        return [{ duration_ms: 0, revision: 1, selected_at: null }];
      if (name === 'finalize_exam_session') return '2026-11-20T00:01:00.000Z';
      throw new Error(`Unexpected RPC ${name}`);
    },
    async select(table) {
      if (table === 'exam_sessions' && boundary === 'load')
        return [
          {
            certification_id: 'saa-c03',
            deadline_at: '2026-11-20T00:01:00.000Z',
            exam_id: draft.id,
            position: 0,
            question_order: [{ question_id: 'q', question_revision: 1 }],
            revision: 0,
            state: 'draft',
          },
        ];
      return [];
    },
  };
}

async function invoke(boundary: Boundary, store: ReturnType<typeof createProgressStore>) {
  if (boundary === 'clock') return store.readExamClock();
  if (boundary === 'finalize') return store.finalizeExam(draft, []);
  if (boundary === 'load') return store.loadExam('saa-c03');
  if (boundary === 'save') return store.saveExamResponse(draft, 0, key, response);
  return store.startExam(draft, 'saa-c03', '2026-11', 60_000);
}

test('each member exam boundary refreshes generation once but never replays the rejected operation', async () => {
  for (const boundary of ['clock', 'load', 'start', 'save', 'finalize'] as const) {
    const storage = memoryStorage();
    const calls: Call[] = [];
    const server = { generation: 0 };
    const store = createProgressStore({
      client: clientFor(boundary, calls, server),
      isCurrent: () => true,
      owner,
      storage,
    });
    await store.initialize();
    const stale = new MemberRetryQueue(owner, storage);
    await stale.setServerGeneration(0);
    await stale.enqueue('saa-c03', memberAttempt);
    server.generation = 1;

    await expect(invoke(boundary, store)).rejects.toMatchObject({ code: 'PT409' });
    expect(
      calls.filter(
        (call) =>
          call.name ===
          {
            clock: 'read_learning_clock',
            finalize: 'finalize_exam_session',
            load: 'read_learning_clock',
            save: 'save_exam_response_confirmed',
            start: 'start_exam_session',
          }[boundary],
      ),
    ).toHaveLength(1);
    expect(store.getSnapshot().examRefreshVersion).toBe(1);
    await store.readExamClock();
    expect(calls.at(-1)).toEqual({ generation: 1, name: 'read_learning_clock' });
    const current = new MemberRetryQueue(owner, storage);
    await current.setServerGeneration(1);
    expect(current.hasPending()).toBeFalse();
  }
});

test('non-generation exam errors do not reload or invalidate the draft', async () => {
  let initialized = 0;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return initialized++;
      if (name === 'load_roadmap_profile_snapshot') return [];
      throw new ProgressApiError(400, '22023');
    },
    async select() {
      return [];
    },
  };
  const store = createProgressStore({ client, isCurrent: () => true, owner, storage: memoryStorage() });
  await store.initialize();
  const initializedAfterFirstLoad = initialized;
  await expect(store.readExamClock()).rejects.toMatchObject({ code: '22023' });
  expect(initialized).toBe(initializedAfterFirstLoad);
  expect(store.getSnapshot().examRefreshVersion).toBe(0);
});
