import { expect, test } from 'bun:test';
import { createProgressStore } from '../src/progress';
import { useExamDraftControls as createExamDraftControls } from '../src/useExamDraftControls';
import { examQuestion } from './progress-store-fixture';

const examKey = 'katana.certification-exam.v1.saa-c03';
const blueprint = { distribution: { storage: 1 }, minutes: 1 };
const storage = { getItem: () => null, removeItem: () => {}, setItem: () => {} };

function draft(id: string) {
  return {
    deadline: Date.now() + 60_000,
    id,
    order: ['["q",1]'],
    position: 0,
    responses: { '["q",1]': { durationMs: 0, flagged: false, selected: ['a'] } },
  };
}

function controls(store: ReturnType<typeof createProgressStore>, staleDraft: ReturnType<typeof draft>) {
  let displayed = staleDraft;
  return {
    controls: createExamDraftControls({
      activeSince: { current: performance.now() },
      bank: [examQuestion],
      blueprint,
      certificationId: 'saa-c03',
      draft: staleDraft,
      examKey,
      failedAuto: { current: false },
      history: [],
      onStart: () => {},
      progressStore: store,
      setDraft: (next) => {
        if (next) displayed = next;
      },
      setError: () => {},
      setNow: () => {},
    }),
    displayed: () => displayed,
  };
}

test('guest controls preserve a newer canonical draft instead of writing a stale component draft', async () => {
  const store = createProgressStore({
    isCurrent: () => true,
    owner: { kind: 'guest', generation: 1 },
    storage,
  });
  const canonical = draft('newer');
  const stale = draft('stale');
  await store.initialize();
  await store.saveGuestExam(examKey, canonical);
  const { controls: staleUpdate, displayed: updated } = controls(store, stale);
  await staleUpdate.update(0, { flagged: true });
  expect(store.readGuestExam(examKey)).toEqual(canonical);
  expect(updated()).toEqual(stale);
  const { controls: staleStart, displayed: started } = controls(store, stale);
  await staleStart.start(1);
  expect(store.readGuestExam(examKey)).toEqual(canonical);
  expect(started()).toEqual(canonical);
});
