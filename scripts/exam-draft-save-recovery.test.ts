import { expect, test } from 'bun:test';
import type { ExamDraft, ExamResponse } from '../src/exam';
import type { ProgressStore } from '../src/progress/storeTypes';
import { useExamDraftControls as createControls } from '../src/useExamDraftControls';
import { examQuestion } from './progress-store-fixture';

const examKey = 'katana.certification-exam.v1.saa-c03';
const blueprint = { distribution: { storage: 1 }, minutes: 1 };

function draft(revision = 1): ExamDraft {
  return {
    deadline: Date.now() + 60_000,
    id: '00000000-0000-0000-0000-000000000001',
    order: ['["q",1]'],
    position: 0,
    responses: { '["q",1]': { durationMs: 0, flagged: false, selected: ['a'] } },
    revision,
  };
}

function member(methods: object) {
  return {
    getSnapshot: () => ({ owner: { generation: 1, kind: 'member' as const, userId: 'member' } }),
    ...methods,
  } as unknown as ProgressStore;
}

function controls(
  store: ProgressStore,
  current: ExamDraft | undefined,
  setDraft: (draft: ExamDraft) => void,
) {
  const pending = { current: false };
  const saving: boolean[] = [];
  const errors: string[] = [];
  return {
    errors,
    pending,
    saving,
    value: createControls({
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
      setDraft: (next) => next && setDraft(next),
      setError: (error) => errors.push(error),
      setNow: () => {},
      setSaving: (value) => saving.push(value),
    }),
  };
}

function lostResponseStore() {
  let confirmed: ExamDraft | undefined;
  return {
    confirmed: () => confirmed,
    store: member({
      async loadExam() {
        return confirmed;
      },
      async saveExamResponse(next: ExamDraft, position: number, key: string, response: ExamResponse) {
        confirmed = {
          ...next,
          position,
          responses: { ...next.responses, [key]: response },
          revision: (next.revision ?? 0) + 1,
        };
        throw new Error('response lost');
      },
    }),
  };
}

async function expectRecovered(current: ExamDraft, position: number) {
  const loss = lostResponseStore();
  let displayed = current;
  const control = controls(loss.store, current, (next) => {
    displayed = next;
  });
  await control.value.update(position, { flagged: true });
  expect(displayed).toBe(loss.confirmed());
  expect(control.errors).toEqual(['']);
  expect(displayed.position).toBe(position);
}

test('normal save adopts the exactly confirmed draft after a lost response', async () => {
  await expectRecovered(draft(), 0);
});

test('lost navigation adopts the committed target position', async () => {
  const current = { ...draft(), order: ['["q",1]', '["next",1]'] };
  await expectRecovered(current, 1);
});

test('start allows only one pending request and resumes a start whose response was lost', async () => {
  let release: (() => void) | undefined;
  let starts = 0;
  let remote: ExamDraft | undefined;
  let displayed: ExamDraft | undefined;
  const store = member({
    async loadExam() {
      return remote;
    },
    async startExam(next: ExamDraft) {
      starts += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      remote = { ...next, revision: 1 };
      throw new Error('response lost');
    },
  });
  const control = controls(store, undefined, (next) => {
    displayed = next;
  });
  const first = control.value.start(1);
  await Promise.resolve();
  await control.value.start(1);
  expect(starts).toBe(1);
  expect(control.pending.current).toBe(true);
  release?.();
  await first;
  await control.value.start(1);
  expect(starts).toBe(1);
  expect(displayed).toBe(remote);
  expect(control.saving).toEqual([true, false, true, false]);
});
