import { expect, test } from 'bun:test';
import { lessonQuestionRef } from '../src/fundamentals/state/grade';
import {
  saveGuestLessonResponse,
  startGuestLessonFinal,
  submitGuestLessonFinal,
} from '../src/fundamentals/state/guestFinal';
import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';
import { guestLessonSnapshot } from '../src/fundamentals/state/guestSnapshot';
import { readGuestLessonSource } from '../src/fundamentals/state/guestSourceCodec';
import { recordGuestLessonStep } from '../src/fundamentals/state/guestStep';
import { lessonAsset as asset } from './fundamentals-state-fixture';

const startedAt = '2026-11-20T00:00:00Z';
const answeredAt = '2026-11-20T00:01:00Z';
const submittedAt = '2026-11-20T00:02:00Z';

function completeReading() {
  let source = initialGuestLesson(asset);
  for (const step of asset.steps.filter((item) => item.kind !== 'final')) {
    const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
    source = recordGuestLessonStep(
      source,
      asset,
      step.id,
      question
        ? { selected: question.correct, receiptId: crypto.randomUUID(), answeredAt, durationMs: 1000 }
        : undefined,
    ).source;
  }
  return source;
}

test('guest slides enforce the published sequence and checkpoint selection before final access', () => {
  const source = initialGuestLesson(asset);
  expect(() => startGuestLessonFinal(source, asset, crypto.randomUUID(), startedAt)).toThrow();
  const second = asset.steps[1];
  if (!second) throw new Error('Missing second fixture step.');
  expect(() => recordGuestLessonStep(source, asset, second.id)).toThrow();
  const completed = completeReading();
  expect(completed.checkpointReceipts).toHaveLength(4);
  expect(guestLessonSnapshot(completed, asset).progress.passedAt).toBeNull();
  expect(readGuestLessonSource(JSON.parse(JSON.stringify(completed)), asset)).toEqual(completed);
  expect(() => readGuestLessonSource({ ...completed, checkpointReceipts: [] }, asset)).toThrow();
  expect(() => readGuestLessonSource({ ...completed, unknownProgress: 'retain' }, asset)).toThrow();
});

test('guest final retries retain separate grades, count unanswered wrong and preserve the first pass', () => {
  let source = completeReading();
  for (const correctCount of [6, 6, 10, 0]) {
    const id = crypto.randomUUID();
    source = startGuestLessonFinal(source, asset, id, startedAt);
    for (let index = 0; index < correctCount; index++) {
      const question = asset.finalQuestions[index];
      if (!question) throw new Error('Missing fixture question.');
      source = saveGuestLessonResponse(
        source,
        asset,
        id,
        index,
        {
          questionRef: lessonQuestionRef(question),
          selected: question.correct,
          selectedAt: answeredAt,
          durationMs: 1000,
        },
        Math.min(index + 1, 11),
      );
    }
    source = submitGuestLessonFinal(
      source,
      asset,
      id,
      submittedAt,
      Array.from({ length: 12 }, () => crypto.randomUUID()),
    );
    const snapshot = guestLessonSnapshot(source, asset);
    expect(snapshot.sessions.at(-1)?.score).toBe(correctCount);
    expect(snapshot.sessions.at(-1)?.passed).toBe(correctCount >= 10);
    expect(snapshot.progress.passedFinalSessionId).toBe(
      correctCount === 10 || snapshot.sessions.length === 4 ? snapshot.sessions[2]?.sessionId : null,
    );
  }
  const restored = readGuestLessonSource(JSON.parse(JSON.stringify(source)), asset);
  expect(guestLessonSnapshot(restored, asset).sessions).toHaveLength(4);
  const first = restored.submittedFinals[0];
  if (!first) throw new Error('Missing submitted fixture session.');
  expect(() =>
    readGuestLessonSource(
      {
        ...restored,
        submittedFinals: [{ ...first, submittedAt: '2026-11-19T00:00:00Z' }],
      },
      asset,
    ),
  ).toThrow();
});
