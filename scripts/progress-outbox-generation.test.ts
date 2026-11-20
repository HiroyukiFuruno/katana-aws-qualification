import { expect, test } from 'bun:test';
import { OutboxGenerationAheadError, restoreOutbox } from '../src/progress/retryOutboxStorage';

function storage(generation: number) {
  const values = new Map<string, string>();
  const key = 'katana.learning-outbox.v1.member-a';
  values.set(key, JSON.stringify({ version: 1, generation, events: [] }));
  return {
    key,
    storage: {
      getItem: (item: string) => values.get(item) ?? null,
      removeItem: (item: string) => void values.delete(item),
      setItem: (item: string, value: string) => void values.set(item, value),
    },
    values,
  };
}

test('a newer request discards only an older outbox generation', () => {
  const current = storage(1);
  expect(restoreOutbox(current.storage, current.key, 2)).toEqual([]);
  expect(current.values.get(current.key)).toBeUndefined();
});

test('an older request preserves a newer outbox generation for a fresh server read', () => {
  const current = storage(2);
  expect(() => restoreOutbox(current.storage, current.key, 1)).toThrow(OutboxGenerationAheadError);
  expect(JSON.parse(current.values.get(current.key) ?? '')).toMatchObject({ generation: 2 });
});
