import { expect, test } from 'bun:test';
import {
  createRandomizedFinalSessionId,
  finalPresentation,
} from '../src/fundamentals/learner/lesson-presentation';
import { readLessonSnapshot } from '../src/fundamentals/state/snapshotCodec';
import { lessonAsset, lessonDate, passedLessonSnapshot } from './fundamentals-state-fixture';

test('legacy UUIDv4 final sessions retain canonical presentation and fixed grading', () => {
  const snapshot = passedLessonSnapshot();
  const session = snapshot.sessions[0];
  if (!session) throw new Error('The fixture needs a submitted session.');
  session.sessionId = '00000000-0000-4000-8000-000000000005';
  session.responses = Object.fromEntries(
    lessonAsset.finalQuestions.slice(0, 5).map((question, position) => [
      String(position),
      {
        questionRef: {
          questionId: question.id,
          revision: question.revision,
          sourceVersion: question.version,
        },
        selected: question.correct,
        selectedAt: lessonDate,
        durationMs: 1000,
      },
    ]),
  );
  session.score = 5;
  session.passed = false;
  snapshot.progress.passedFinalSessionId = null;
  snapshot.progress.passedAt = null;

  const restored = readLessonSnapshot(snapshot, lessonAsset).sessions[0];
  if (!restored) throw new Error('The legacy session is missing.');
  const presentation = finalPresentation(lessonAsset, restored.sessionId);
  expect(presentation.map(({ canonicalPosition }) => canonicalPosition)).toEqual(
    Array.from({ length: lessonAsset.finalQuestions.length }, (_, position) => position),
  );
  expect(presentation.map(({ question }) => question.choices)).toEqual(
    lessonAsset.finalQuestions.map((question) => question.choices),
  );
  expect(
    presentation.filter(({ canonicalPosition }) => restored.responses[String(canonicalPosition)]).length,
  ).toBe(5);
  expect(
    presentation.filter(({ canonicalPosition }) => !restored.responses[String(canonicalPosition)])
      .length,
  ).toBe(7);
  expect(restored.score).toBe(5);
});

test('presentation v1 session identifiers are UUIDv8 and preserve randomized presentation', () => {
  const firstId = createRandomizedFinalSessionId();
  const secondId = createRandomizedFinalSessionId();
  expect(firstId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(secondId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(secondId).not.toBe(firstId);

  const sessionId = '00000000-0000-8000-8000-000000000006';
  const first = finalPresentation(lessonAsset, sessionId);
  const second = finalPresentation(lessonAsset, sessionId);
  expect(second).toEqual(first);
  expect(first.map(({ canonicalPosition }) => canonicalPosition)).not.toEqual(
    Array.from({ length: lessonAsset.finalQuestions.length }, (_, position) => position),
  );
  expect(first.map(({ question }) => question.choices)).not.toEqual(
    lessonAsset.finalQuestions.map((question) => question.choices),
  );
});
