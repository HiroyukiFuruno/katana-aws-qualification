import type { LessonRecordQuestion } from '../delivery/recordAsset';
import { integer, object, strings, text, timestamp } from './codecPrimitives';
import { lessonQuestionRef, sameLessonQuestionRef, validateLessonSelection } from './grade';
import type { LessonQuestionRef, LessonResponse } from './types';

export function readLessonQuestionRef(value: unknown): LessonQuestionRef {
  const row = object(value, 'questionRef');
  const revision = integer(row.revision, 'questionRef.revision');
  if (revision < 1) throw new Error('Invalid lesson question revision.');
  return {
    questionId: text(row.questionId, 'questionRef.questionId'),
    revision,
    sourceVersion: text(row.sourceVersion, 'questionRef.sourceVersion'),
  };
}

export function readLessonResponse(value: unknown, question: LessonRecordQuestion): LessonResponse {
  const row = object(value, 'response');
  const questionRef = readLessonQuestionRef(row.questionRef);
  if (!sameLessonQuestionRef(questionRef, lessonQuestionRef(question))) {
    throw new Error('The lesson response does not match the fixed question.');
  }
  const selected = strings(row.selected, 'response.selected');
  validateLessonSelection(question, selected);
  return {
    questionRef,
    selected,
    selectedAt: timestamp(row.selectedAt, 'response.selectedAt'),
    durationMs: integer(row.durationMs, 'response.durationMs', 86_400_000),
  };
}

export function readLessonResponses(value: unknown, questions: readonly LessonRecordQuestion[]) {
  const row = object(value, 'responses');
  const responses: Record<string, LessonResponse> = {};
  for (const [position, response] of Object.entries(row)) {
    if (!/^(0|[1-9]\d*)$/.test(position)) throw new Error('Invalid lesson response position.');
    const question = questions[Number(position)];
    if (!question) throw new Error('The lesson response is outside the fixed order.');
    responses[position] = readLessonResponse(response, question);
  }
  return responses;
}
