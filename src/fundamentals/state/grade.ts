import type { LessonRecordQuestion } from '../delivery/recordAsset';
import type { LessonQuestionRef } from './types';

export function lessonQuestionRef(question: LessonRecordQuestion): LessonQuestionRef {
  return {
    questionId: question.id,
    revision: question.revision,
    sourceVersion: question.version,
  };
}

export function sameLessonQuestionRef(left: LessonQuestionRef, right: LessonQuestionRef) {
  return (
    left.questionId === right.questionId &&
    left.revision === right.revision &&
    left.sourceVersion === right.sourceVersion
  );
}

export function validateLessonSelection(question: LessonRecordQuestion, selected: readonly string[]) {
  if (
    new Set(selected).size !== selected.length ||
    selected.some((id) => !question.choices.some((choice) => choice.id === id))
  ) {
    throw new Error('Invalid lesson selection.');
  }
}

export function isLessonAnswerCorrect(question: LessonRecordQuestion, selected: readonly string[]) {
  validateLessonSelection(question, selected);
  return (
    selected.length === question.requiredChoices &&
    question.correct.length === question.requiredChoices &&
    question.correct.every((id) => selected.includes(id))
  );
}

export function gradeLessonFinal(
  questions: readonly LessonRecordQuestion[],
  responses: Readonly<Record<string, { selected: string[] }>>,
) {
  if (questions.length !== 12) throw new Error('A lesson final requires twelve fixed questions.');
  for (const position of Object.keys(responses)) {
    if (!/^(0|[1-9]\d*)$/.test(position) || Number(position) >= questions.length) {
      throw new Error('A lesson response is outside the fixed question order.');
    }
  }
  const score = questions.reduce(
    (total, question, index) =>
      total + Number(isLessonAnswerCorrect(question, responses[String(index)]?.selected ?? [])),
    0,
  );
  const requiredScore = Math.ceil(questions.length * 0.8);
  return { score, requiredScore, passed: score >= requiredScore };
}
