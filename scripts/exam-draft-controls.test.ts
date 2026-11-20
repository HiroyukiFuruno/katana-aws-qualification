import { expect, test } from 'bun:test';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
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
      savePending: { current: false },
      setDraft: (next) => {
        if (next) displayed = next;
      },
      setError: () => {},
      setSaving: () => {},
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

test('controls reject another update while the first member save is pending', async () => {
  let release: (() => void) | undefined;
  let requested: (() => void) | undefined;
  let writes = 0;
  const client: ProgressRpcClient = {
    async rpc(name) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot') return [];
      if (name !== 'save_exam_response_confirmed') throw new Error(`unexpected rpc: ${name}`);
      writes += 1;
      requested?.();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return [{ duration_ms: 1, revision: 2, selected_at: '2026-11-20T00:00:00.000Z' }];
    },
    async select() {
      return [];
    },
  };
  const store = createProgressStore({
    client,
    isCurrent: () => true,
    owner: { kind: 'member', generation: 1, userId: 'member-a' },
    storage,
  });
  const pending = { current: false };
  const saving: boolean[] = [];
  const current = { ...draft('member'), revision: 1 };
  const control = createExamDraftControls({
    activeSince: { current: performance.now() },
    bank: [examQuestion],
    blueprint,
    certificationId: 'saa-c03',
    draft: current,
    examKey,
    failedAuto: { current: false },
    history: [],
    onStart: () => {},
    progressStore: store,
    savePending: pending,
    setDraft: () => {},
    setError: () => {},
    setNow: () => {},
    setSaving: (next) => saving.push(next),
  });
  await store.initialize();
  const requestedSave = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const first = control.update(0, { flagged: true });
  await requestedSave;
  await control.update(0, { flagged: false });
  expect(writes).toBe(1);
  expect(pending.current).toBe(true);
  release?.();
  await first;
  expect(pending.current).toBe(false);
  expect(saving).toEqual([true, false]);
});
