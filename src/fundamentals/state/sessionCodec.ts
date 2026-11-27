import type { LessonRecordAsset } from '../delivery/recordAsset';
import { integer, nullable, object, text, timestamp, uuid } from './codecPrimitives';
import { gradeLessonFinal } from './grade';
import { readLessonResponses } from './responseCodec';
import type { LessonFinalSession } from './types';

export function readLessonFinalSession(value: unknown, asset: LessonRecordAsset): LessonFinalSession {
  const row = object(value, 'finalSession');
  const state = text(row.state, 'finalSession.state');
  if (state !== 'draft' && state !== 'submitted') throw new Error('Invalid final session state.');
  const responses = readLessonResponses(row.responses, asset.finalQuestions);
  const requiredScore = integer(row.requiredScore, 'requiredScore', asset.finalQuestions.length);
  if (requiredScore !== asset.finalPolicy.passCorrect) throw new Error('Unexpected lesson threshold.');
  const score = nullable(row.score, (item) => integer(item, 'score', asset.finalQuestions.length));
  const submittedAt = nullable(row.submittedAt, (item) => timestamp(item, 'submittedAt'));
  const passed = row.passed;
  if (state === 'draft') {
    if (score !== null || passed !== null || submittedAt !== null) {
      throw new Error('A draft cannot contain a final grade.');
    }
  } else {
    const grade = gradeLessonFinal(asset.finalQuestions, responses);
    if (score !== grade.score || passed !== grade.passed || submittedAt === null) {
      throw new Error('The submitted result does not match its fixed responses.');
    }
  }
  return {
    sessionId: uuid(row.sessionId, 'sessionId'),
    position: integer(row.position, 'position', asset.finalQuestions.length - 1),
    state,
    responses,
    score,
    requiredScore,
    passed: passed as boolean | null,
    submittedAt,
    revision: integer(row.revision, 'session.revision'),
  };
}
