import { expect, test } from 'bun:test';
import { createBrowserLegacyStorage } from '../src/progress/migrationBrowserStorage';

function storage() {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

test('legacy browser storage exposes only the historical wrong-answer cookie', () => {
  let expired = false;
  const local = storage();
  local.setItem('saa-study.attempts.v1', '[]');
  const legacy = createBrowserLegacyStorage(local, {
    expire: () => {
      expired = true;
    },
    read: () => 'analytics=allowed; saa_study_incorrect_v1=q-1%2Cq-2',
  });
  expect(legacy.keys()).toEqual(['saa-study.attempts.v1']);
  expect(legacy.readIncorrectCookie()).toBe('q-1,q-2');
  legacy.expireIncorrectCookie();
  expect(expired).toBe(true);
});
