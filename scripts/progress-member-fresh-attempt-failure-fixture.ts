import type { Attempt } from '../src/attempts';
import type { ProgressRpcClient } from '../src/progress';
import { memberAttempt } from './progress-store-fixture';

export const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
export const wrong: Attempt = {
  ...memberAttempt,
  correct: ['C'],
  isCorrect: false,
  reward: 0,
  selected: ['W'],
};
export const right: Attempt = { ...wrong, correct: ['C'], isCorrect: true, reward: 1, selected: ['C'] };

export function prepared(history: Attempt[]) {
  const same = history.filter(
    (item) => item.questionId === right.questionId && item.questionRevision === right.questionRevision,
  );
  return {
    ...right,
    attemptNumber: same.length + 1,
    priorIncorrectCount: same.filter((item) => !item.isCorrect).length,
  };
}

export function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

export function client(
  readFailure: () => unknown,
  writes: Record<string, unknown>[],
): ProgressRpcClient {
  const rows: Record<string, unknown>[] = [];
  return {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot') return [];
      if (name !== 'append_learning_event') return;
      const event = args.p_event as Record<string, unknown>;
      writes.push(event);
      if (writes.length === 1) throw new Error('offline');
      rows.push(event);
      return event.event_id as string;
    },
    async select(_table, filters = {}) {
      const failure = filters.question_id ? readFailure() : undefined;
      if (failure) throw failure;
      return rows as never;
    },
  };
}
