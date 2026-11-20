import { expect, test } from 'bun:test';
import type { Attempt } from '../src/attempts';
import { historyKey } from '../src/history';
import {
  importLegacy,
  inspectLegacy,
  type LegacyStorage,
  type ProgressRpcClient,
} from '../src/progress';
import { eventPayload } from '../src/progress/memberEventCodec';
import type { Question } from '../src/questions';

const attempt: Attempt = {
  answeredAt: '2026-11-20T00:00:00.000Z',
  attemptNumber: 1,
  category: 'storage',
  correct: ['a'],
  durationMs: 1,
  isCorrect: false,
  mode: 'study',
  priorIncorrectCount: 0,
  questionId: 'q-1',
  questionRevision: 1,
  reviewCorrect: null,
  reward: 0,
  schemaVersion: 1,
  selected: ['b'],
  sourceVersion: 'v1',
};

function storage(): LegacyStorage & { setItem(key: string, value: string): void } {
  const values = new Map<string, string>();
  return {
    expireIncorrectCookie: () => {},
    getItem: (key) => values.get(key) ?? null,
    keys: () => [...values.keys()],
    readIncorrectCookie: () => null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

test('legacy preview preserves JSON source and reports its importable rows', () => {
  const local = storage();
  const raw = JSON.stringify([attempt]);
  local.setItem(historyKey, raw);
  const preview = inspectLegacy(local);
  expect(preview.sources).toContainEqual(
    expect.objectContaining({ raw, rows: 1, sourceName: 'history-local-storage' }),
  );
  expect(preview.errors).toBe(0);
});

test('legacy preview reports malformed history without removing its original payload', () => {
  const local = storage();
  local.setItem(historyKey, '{');
  const preview = inspectLegacy(local);
  expect(preview.errors).toBe(1);
  expect(preview.sources[0]).toMatchObject({ raw: '{', rows: 0 });
  expect(local.getItem(historyKey)).toBe('{');
});

test('explicit import writes a stable event with the initialized member generation before removal', async () => {
  const local = storage();
  local.setItem(historyKey, JSON.stringify([attempt]));
  const events: Record<string, unknown>[] = [];
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'initialize_learning_state') return 7;
      if (name === 'begin_migration') return args.p_manifest_id;
      if (name === 'append_learning_event') {
        events.push(args.p_event as Record<string, unknown>);
        return (args.p_event as { event_id: string }).event_id;
      }
      return undefined;
    },
    async select(table) {
      return table === 'learning_events' ? events : [];
    },
  };
  const question: Question = {
    category: 'storage',
    choices: [
      { explanation: 'E', id: 'a', text: 'A' },
      { explanation: 'E', id: 'b', text: 'B' },
    ],
    correct: ['a'],
    id: 'q-1',
    prompt: 'P',
    revision: 1,
    source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
    title: 'T',
    version: 'v1',
  };
  const report = await importLegacy({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: '00000000-0000-0000-0000-000000000001' },
    resolveQuestion: async () => ({ certificationId: 'saa-c03', question }),
    storage: local,
  });
  expect(report).toMatchObject({ imported: 1, rejected: 0 });
  expect(local.getItem(historyKey)).toBeNull();
  expect(calls.find((call) => call.name === 'append_learning_event')).toMatchObject({
    args: { p_expected_generation: 7 },
  });
});

test('legacy wrong-answer index is removed only after every ID is reconstructed', async () => {
  const local = storage();
  const key = 'saa-study.incorrect.v1';
  const event = eventPayload({ ...attempt, certificationId: 'saa-c03', eventId: 'event-1' });
  const client: ProgressRpcClient = {
    async rpc<T>(name, args) {
      if (name === 'initialize_learning_state') return 1 as T;
      if (name === 'begin_migration') return args.p_manifest_id as T;
      return undefined as T;
    },
    async select<T>(table) {
      return (table === 'learning_events' ? [event] : []) as T;
    },
  };
  const input = {
    client,
    isCurrent: () => true,
    owner: { kind: 'member' as const, generation: 1, userId: '00000000-0000-0000-0000-000000000001' },
    resolveQuestion: async () => undefined,
    storage: local,
  };
  local.setItem(key, JSON.stringify(['q-1']));
  expect((await importLegacy(input)).sources).toContainEqual(
    expect.objectContaining({ removed: true, sourceName: 'wrong-index-local-storage' }),
  );
  expect(local.getItem(key)).toBeNull();
  const raw = JSON.stringify(['q-1', 'missing']);
  local.setItem(key, raw);
  expect((await importLegacy(input)).sources).toContainEqual(
    expect.objectContaining({ rejected: 1, removed: false, sourceName: 'wrong-index-local-storage' }),
  );
  expect(local.getItem(key)).toBe(raw);
});
