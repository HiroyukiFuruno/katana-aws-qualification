import { expect, test } from 'bun:test';
import { remainingCertifications } from '../src/assessment';
import { setActiveProgressStore } from '../src/history';
import { createProgressStore } from '../src/progress';
import { guestProgressConsentKey, setGuestProgressConsent } from '../src/progress/guest';
import { parseStoredProfile } from '../src/progress/profileCodec';
import { saveProfile } from '../src/roadmapProfile';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

test('a captured roadmap store rejects a save after its owner is replaced', async () => {
  const first = createProgressStore({
    isCurrent: () => true,
    owner: { generation: 1, kind: 'guest' },
    storage: storage(),
  });
  const second = createProgressStore({
    isCurrent: () => true,
    owner: { generation: 2, kind: 'guest' },
    storage: storage(),
  });
  await Promise.all([first.initialize(), second.initialize()]);
  setActiveProgressStore(first);
  try {
    const saving = saveProfile({ answers: {}, earned: ['saa-c03'] }, first);
    setActiveProgressStore(second);
    await expect(saving).rejects.toThrow('保存先が切り替わりました');
  } finally {
    setActiveProgressStore(undefined);
    first.dispose();
    second.dispose();
  }
});

test('guest stored profiles normalize replaced certification ids', () => {
  const normalized = parseStoredProfile(
    JSON.stringify({ earned: ['dva-c02', 'sap-c02', 'dva-c03'], answers: {} }),
  );
  expect(normalized).toEqual({ earned: ['dva-c03', 'sap-c03'], answers: {} });
  const remaining = remainingCertifications(normalized.earned, '2026-11-20').map(
    (certification) => certification.id,
  );
  expect(remaining).not.toContain('dva-c03');
  expect(remaining).not.toContain('sap-c03');
});

test('guest consent refresh loads the normalized profile into the existing store', async () => {
  const values = new Map([['katana.certification-profile.v1', '{"earned":["dva-c02"],"answers":{}}']]);
  const browserStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { generation: 1, kind: 'guest' },
    storage: browserStorage,
  });
  await store.initialize();
  expect(store.getSnapshot().profile.earned).toEqual([]);
  setGuestProgressConsent(browserStorage, true);
  await store.retryPending();
  expect(store.getSnapshot().profile.earned).toEqual(['dva-c03']);
  expect(values.get(guestProgressConsentKey)).toBe('granted');
  await store.dispose();
});
