import { expect, test } from 'bun:test';
import { createMemberLessonRepository } from '../src/fundamentals/state/memberRepository';
import { emptyLessonSnapshot, lessonAsset, lessonSessionId } from './fundamentals-state-fixture';

function client(values: unknown[]) {
  const calls: { args: Record<string, unknown>; name: string }[] = [];
  return {
    calls,
    rpc: async <T>(name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const value = values.shift();
      if (value instanceof Error) throw value;
      return value as T;
    },
    select: async <T>() => [] as T,
  };
}

test('uses exact RPC contracts with caller receipts and fixed question references', async () => {
  const transport = client([4, emptyLessonSnapshot(), emptyLessonSnapshot(), emptyLessonSnapshot()]);
  const repository = createMemberLessonRepository({ client: transport, isCurrent: () => true });
  await repository.initialize();
  await repository.recordStep(lessonAsset, {
    stepId: lessonAsset.steps[0]?.id ?? '',
    selected: undefined,
    expectedRevision: 0,
    receiptId: '10000000-0000-4000-8000-000000000001',
    durationMs: 12,
  });
  await repository.startFinal(lessonAsset, { expectedRevision: 0, sessionId: lessonSessionId });
  await repository.saveResponse(lessonAsset, {
    sessionId: lessonSessionId,
    expectedRevision: 0,
    position: 0,
    selected: lessonAsset.finalQuestions[0]?.correct ?? [],
    receiptId: '10000000-0000-4000-8000-000000000002',
    durationMs: 13,
    cursorPosition: 1,
  });
  expect(transport.calls).toEqual([
    { name: 'initialize_learning_state', args: {} },
    {
      name: 'record_fundamentals_step',
      args: expect.objectContaining({ p_expected_generation: 4, p_kind: 'slide', p_selected: null }),
    },
    {
      name: 'start_fundamentals_final',
      args: expect.objectContaining({ p_expected_generation: 4, p_session_id: lessonSessionId }),
    },
    {
      name: 'save_fundamentals_final_response',
      args: expect.objectContaining({
        p_expected_generation: 4,
        p_session_id: lessonSessionId,
        p_question_ref: {
          questionId: lessonAsset.finalQuestions[0]?.id,
          revision: lessonAsset.finalQuestions[0]?.revision,
          sourceVersion: lessonAsset.finalQuestions[0]?.version,
        },
      }),
    },
  ]);
});

test('rejects malformed snapshots and owner changes after an RPC await', async () => {
  let resolve: ((value: unknown) => void) | undefined;
  let current = true;
  const transport = {
    rpc: <T>(name: string) =>
      new Promise<T>((done) => {
        if (name === 'initialize_learning_state') done(1 as T);
        else resolve = done as (value: unknown) => void;
      }),
    select: async <T>() => [] as T,
  };
  const repository = createMemberLessonRepository({ client: transport, isCurrent: () => current });
  await repository.initialize();
  const pending = repository.load(lessonAsset);
  current = false;
  resolve?.(emptyLessonSnapshot());
  await expect(pending).rejects.toThrow('Progress owner changed');
  const malformed = createMemberLessonRepository({
    client: client([1, { bad: true }]),
    isCurrent: () => true,
  });
  await malformed.initialize();
  await expect(malformed.load(lessonAsset)).rejects.toThrow();
});

test('validates every requested summary field and identity', async () => {
  const unit = { unitId: lessonAsset.unit.id, contentVersion: lessonAsset.contentVersion };
  const row = {
    ...unit,
    completedSlides: 1,
    totalSlides: 2,
    completedCheckpoints: 0,
    totalCheckpoints: 1,
    activeFinalSessionId: null,
    passedAt: null,
    latestScore: null,
    requiredScore: null,
  };
  const repository = createMemberLessonRepository({ client: client([3, [row]]), isCurrent: () => true });
  await repository.initialize();
  await expect(repository.summaries([unit])).resolves.toEqual([row]);
  const perfect = { ...row, latestScore: 12, requiredScore: 10 };
  const perfectRepository = createMemberLessonRepository({
    client: client([3, [perfect]]),
    isCurrent: () => true,
  });
  await perfectRepository.initialize();
  await expect(perfectRepository.summaries([unit])).resolves.toEqual([perfect]);
  const invalid = createMemberLessonRepository({
    client: client([3, [{ ...row, extra: true }]]),
    isCurrent: () => true,
  });
  await invalid.initialize();
  await expect(invalid.summaries([unit])).rejects.toThrow('Unknown lesson summary field');
});
