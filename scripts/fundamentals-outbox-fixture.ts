import type { MemberLessonRepository } from '../src/fundamentals/state/memberTypes';
import { createLessonOutbox } from '../src/fundamentals/state/outbox';
import type { LessonCommand, LessonOutboxStorage } from '../src/fundamentals/state/outboxTypes';
import { emptyLessonSnapshot, lessonAsset } from './fundamentals-state-fixture';

export const userId = '10000000-0000-4000-8000-000000000001';
export const ids = [
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
];

export function storage(): LessonOutboxStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

export function command(id: string, revision = 0): LessonCommand {
  return {
    commandId: id,
    contentVersion: lessonAsset.contentVersion,
    kind: 'recordStep',
    unitId: lessonAsset.unit.id,
    input: {
      durationMs: 12,
      expectedRevision: revision,
      receiptId: id,
      stepId: lessonAsset.steps[0]?.id ?? '',
    },
  };
}

export function startCommand(id: string): LessonCommand {
  return {
    commandId: id,
    contentVersion: lessonAsset.contentVersion,
    kind: 'startFinal',
    unitId: lessonAsset.unit.id,
    input: { expectedRevision: 0, sessionId: id },
  };
}

export function repository(
  record: (input: LessonCommand['input']) => Promise<ReturnType<typeof emptyLessonSnapshot>>,
  generations = [1],
) {
  const calls: LessonCommand['input'][] = [];
  const value: MemberLessonRepository = {
    initialize: async () => generations.shift() ?? 1,
    load: async () => emptyLessonSnapshot(),
    recordStep: async (_asset, input) => {
      calls.push(input);
      return record(input);
    },
    startFinal: async () => emptyLessonSnapshot(),
    saveResponse: async () => emptyLessonSnapshot(),
    finalize: async () => emptyLessonSnapshot(),
    summaries: async () => [],
  };
  return { calls, value };
}

export function outbox(store: LessonOutboxStorage, repo: MemberLessonRepository, current = () => true) {
  return createLessonOutbox({
    storage: store,
    repository: repo,
    userId,
    isCurrent: current,
    resolveAsset: async (unitId, version) =>
      unitId === lessonAsset.unit.id && version === lessonAsset.contentVersion ? lessonAsset : undefined,
  });
}
