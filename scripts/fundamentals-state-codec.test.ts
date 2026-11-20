import { expect, test } from 'bun:test';
import { timestamp } from '../src/fundamentals/state/codecPrimitives';
import { readLessonSnapshot } from '../src/fundamentals/state/snapshotCodec';
import {
  emptyLessonSnapshot,
  lessonAsset,
  lessonDate,
  passedLessonSnapshot,
} from './fundamentals-state-fixture';

test('current-version empty and passed lesson snapshots retain fixed order and microsecond timestamps', () => {
  const empty = emptyLessonSnapshot();
  expect(readLessonSnapshot(empty, lessonAsset)).toEqual(empty);
  const passed = passedLessonSnapshot();
  expect(readLessonSnapshot(passed, lessonAsset)).toEqual(passed);
  expect(readLessonSnapshot(passed, lessonAsset).progress.passedAt).toBe(lessonDate);
});

test('old versions, foreign steps and unreachable completion cannot become current lesson progress', () => {
  const changed = emptyLessonSnapshot();
  changed.contentVersion = 'old-version';
  expect(() => readLessonSnapshot(changed, lessonAsset)).toThrow();
  const foreign = emptyLessonSnapshot();
  foreign.progress.completedSlideIds = ['another-unit-slide'];
  expect(() => readLessonSnapshot(foreign, lessonAsset)).toThrow();
  const skipped = emptyLessonSnapshot();
  const second = lessonAsset.steps[1];
  if (!second) throw new Error('The fixture needs two reading steps.');
  skipped.progress.completedSlideIds = [second.id];
  skipped.progress.furthestPlanPosition = 1;
  expect(() => readLessonSnapshot(skipped, lessonAsset)).toThrow();
});

test('a score cannot pass a unit without required reading and checkpoints', () => {
  const missingReading = passedLessonSnapshot();
  missingReading.progress.completedSlideIds = [];
  missingReading.progress.completedCheckpointIds = [];
  missingReading.progress.furthestPlanPosition = 0;
  expect(() => readLessonSnapshot(missingReading, lessonAsset)).toThrow();
  const missingCheckpoint = passedLessonSnapshot();
  missingCheckpoint.progress.completedCheckpointIds.pop();
  expect(() => readLessonSnapshot(missingCheckpoint, lessonAsset)).toThrow();
});

test('grades and response references must match the same immutable final session', () => {
  const forged = passedLessonSnapshot();
  const session = forged.sessions[0];
  if (!session) throw new Error('The fixture needs a submitted session.');
  session.score = 12;
  expect(() => readLessonSnapshot(forged, lessonAsset)).toThrow();
  const wrongReference = passedLessonSnapshot();
  const response = wrongReference.sessions[0]?.responses['0'];
  if (!response) throw new Error('The fixture needs a response.');
  response.questionRef.revision++;
  expect(() => readLessonSnapshot(wrongReference, lessonAsset)).toThrow();
  const missingSession = passedLessonSnapshot();
  missingSession.sessions = [];
  expect(() => readLessonSnapshot(missingSession, lessonAsset)).toThrow();
});

test('malformed dates and impossible calendar days are rejected', () => {
  for (const value of ['2026-02-30T10:00:00Z', '2026-11-20T24:00:00Z', 'not-a-date', 0, null]) {
    expect(() => timestamp(value, 'selectedAt')).toThrow();
  }
});

test('final session position is separate from the reading step identifier in real RPC snapshots', () => {
  const draft = passedLessonSnapshot();
  const session = draft.sessions[0];
  if (!session) throw new Error('Missing fixture session.');
  Object.assign(session, {
    state: 'draft',
    responses: {},
    score: null,
    passed: null,
    submittedAt: null,
  });
  Object.assign(draft.progress, {
    activeFinalSessionId: session.sessionId,
    passedFinalSessionId: null,
    passedAt: null,
    resumeStage: 'final',
    resumeStepId: null,
  });
  expect(readLessonSnapshot(draft, lessonAsset)).toEqual(draft);
  draft.progress.resumeStepId = '0';
  expect(() => readLessonSnapshot(draft, lessonAsset)).toThrow('dedicated session position');
});
