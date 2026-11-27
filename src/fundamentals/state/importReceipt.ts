import type { LessonRecordAsset } from '../delivery/recordAsset';
import { lessonQuestionRef, sameLessonQuestionRef } from './grade';
import { guestLessonSnapshot } from './guestSnapshot';
import { sameLessonInstant } from './instant';
import type { GuestLessonSource, LessonFinalSession, LessonSnapshot } from './types';

function includes(left: readonly string[], right: readonly string[]) {
  return right.every((item) => left.includes(item));
}

function sameResponses(left: LessonFinalSession, right: LessonFinalSession) {
  const positions = Object.keys(right.responses);
  return (
    Object.keys(left.responses).length === positions.length &&
    positions.every((position) => {
      const actual = left.responses[position];
      const expected = right.responses[position];
      return (
        actual !== undefined &&
        expected !== undefined &&
        sameLessonQuestionRef(actual.questionRef, expected.questionRef) &&
        actual.selected.length === expected.selected.length &&
        actual.selected.every((id) => expected.selected.includes(id)) &&
        sameLessonInstant(actual.selectedAt, expected.selectedAt) &&
        actual.durationMs === expected.durationMs
      );
    })
  );
}

function hasSession(snapshot: LessonSnapshot, expected: LessonFinalSession) {
  const actual = snapshot.sessions.find((session) => session.sessionId === expected.sessionId);
  return (
    actual !== undefined &&
    actual.state === expected.state &&
    actual.position === expected.position &&
    actual.score === expected.score &&
    actual.requiredScore === expected.requiredScore &&
    actual.passed === expected.passed &&
    (actual.submittedAt === null || expected.submittedAt === null
      ? actual.submittedAt === expected.submittedAt
      : sameLessonInstant(actual.submittedAt, expected.submittedAt)) &&
    sameResponses(actual, expected)
  );
}

function canonicalSubmitted(session: LessonFinalSession, asset: LessonRecordAsset): LessonFinalSession {
  if (session.state !== 'submitted') return session;
  const submittedAt = session.submittedAt;
  if (!submittedAt) throw new Error('The guest submission time is missing.');
  return {
    ...session,
    responses: Object.fromEntries(
      asset.finalQuestions.map((question, position) => [
        String(position),
        session.responses[String(position)] ?? {
          questionRef: lessonQuestionRef(question),
          selected: [],
          selectedAt: submittedAt,
          durationMs: 0,
        },
      ]),
    ),
  };
}

export function verifiesImportedGuestLesson(
  snapshot: LessonSnapshot,
  source: GuestLessonSource,
  asset: LessonRecordAsset,
) {
  const expected = guestLessonSnapshot(source, asset);
  return (
    includes(snapshot.progress.completedSlideIds, expected.progress.completedSlideIds) &&
    includes(snapshot.progress.completedCheckpointIds, expected.progress.completedCheckpointIds) &&
    expected.sessions.every((session) => hasSession(snapshot, canonicalSubmitted(session, asset)))
  );
}
