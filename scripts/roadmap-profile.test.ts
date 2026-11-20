import { expect, test } from 'bun:test';
import { setActiveProgressStore } from '../src/history';
import { createProgressStore } from '../src/progress';
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
