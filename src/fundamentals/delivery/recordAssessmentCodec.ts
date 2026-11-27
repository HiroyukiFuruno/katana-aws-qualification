import { exactFields, integer, object, strings, text } from '../state/codecPrimitives';
import type { DeliveryFinalPolicy } from './artifactTypes';

export type LessonRecordQuestion = {
  category: string;
  choices: { id: string }[];
  correct: string[];
  id: string;
  requiredChoices: number;
  revision: number;
  selectionPolarity: 'correct' | 'incorrect';
  version: string;
};

function readQuestion(value: unknown): LessonRecordQuestion {
  const row = object(value, 'recordQuestion');
  exactFields(row, [
    'category',
    'choices',
    'correct',
    'id',
    'requiredChoices',
    'revision',
    'selectionPolarity',
    'version',
  ]);
  if (!Array.isArray(row.choices)) throw new Error('Invalid lesson record choices.');
  const choices = row.choices.map((choice) => {
    const item = object(choice, 'recordChoice');
    exactFields(item, ['id']);
    return { id: text(item.id, 'recordChoice.id') };
  });
  if (choices.length < 2 || new Set(choices.map((choice) => choice.id)).size !== choices.length) {
    throw new Error('Invalid lesson record choice identifiers.');
  }
  const correct = strings(row.correct, 'recordQuestion.correct');
  const requiredChoices = integer(row.requiredChoices, 'recordQuestion.requiredChoices', choices.length);
  if (
    requiredChoices < 1 ||
    correct.length !== requiredChoices ||
    correct.some((id) => !choices.some((choice) => choice.id === id))
  ) {
    throw new Error('Invalid lesson record grading choices.');
  }
  const selectionPolarity = text(row.selectionPolarity, 'recordQuestion.selectionPolarity');
  if (selectionPolarity !== 'correct' && selectionPolarity !== 'incorrect') {
    throw new Error('Invalid lesson record selection polarity.');
  }
  const revision = integer(row.revision, 'recordQuestion.revision');
  if (revision < 1) throw new Error('Invalid lesson record question revision.');
  return {
    category: text(row.category, 'recordQuestion.category'),
    choices,
    correct,
    id: text(row.id, 'recordQuestion.id'),
    requiredChoices,
    revision,
    selectionPolarity,
    version: text(row.version, 'recordQuestion.version'),
  };
}

export function readRecordQuestions(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid lesson record questions: ${field}`);
  const questions = value.map(readQuestion);
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw new Error(`Duplicate lesson record question: ${field}`);
  }
  return questions;
}

export function readRecordFinalPolicy(value: unknown): DeliveryFinalPolicy {
  const row = object(value, 'recordFinalPolicy');
  exactFields(row, ['attemptScope', 'passCorrect', 'questionCount', 'ratio']);
  if (
    row.attemptScope !== 'current-attempt-only' ||
    typeof row.ratio !== 'number' ||
    row.ratio !== 0.8
  ) {
    throw new Error('Invalid lesson record final policy.');
  }
  const questionCount = integer(row.questionCount, 'recordFinalPolicy.questionCount');
  const passCorrect = integer(row.passCorrect, 'recordFinalPolicy.passCorrect', questionCount);
  if (questionCount !== 12 || passCorrect !== Math.ceil(questionCount * 0.8)) {
    throw new Error('Invalid lesson record final grade.');
  }
  return { attemptScope: 'current-attempt-only', passCorrect, questionCount, ratio: 0.8 };
}
