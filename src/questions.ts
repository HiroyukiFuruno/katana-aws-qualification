import type { Locale } from './locales';

type QuestionDetails = {
  id: string;
  revision: number;
  locale?: Locale;
  category: string;
  categoryLabel?: string;
  examDomain?: string;
  examDomainLabel?: string;
  similarityGroup?: string;
  version: string;
  versionLabel?: string;
  title: string;
  prompt: string;
  choices: { id: string; text: string; explanation: string }[];
  correct: string[];
  source: { url: string; label: string };
  references?: { url: string; label: string }[];
  sourceLabel?: string;
  learning?: {
    reason: string;
    concept: string;
    check?: { prompt: string; answer: string };
  };
};

export type StructuredQuestion = QuestionDetails &
  (
    | { format: 'ordering'; prompts?: never }
    | { format: 'matching'; prompts: { id: string; text: string }[] }
  );

export type Question = (QuestionDetails & { format?: undefined; prompts?: never }) | StructuredQuestion;

export const questionKey = (question: Pick<Question, 'id' | 'revision'>) =>
  JSON.stringify([question.id, question.revision]);

export const questionGroupKey = (question: Pick<Question, 'id' | 'similarityGroup'>) =>
  question.similarityGroup ? `group:${question.similarityGroup}` : `id:${question.id}`;

export const examDomainOf = (question: Question) => question.examDomain ?? question.category;

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function validQuestionFormat(question: Question) {
  switch (question.format) {
    case undefined:
      return question.prompts === undefined;
    case 'ordering':
      return (
        question.prompts === undefined && question.choices.length <= 5 && question.correct.length >= 3
      );
    case 'matching':
      return (
        Array.isArray(question.prompts) &&
        question.prompts.length >= 3 &&
        question.prompts.length <= 7 &&
        question.prompts.length === question.correct.length &&
        question.choices.length === question.correct.length &&
        question.prompts.every((prompt) => prompt && [prompt.id, prompt.text].every(text)) &&
        new Set(question.prompts.map((prompt) => prompt.id)).size === question.prompts.length
      );
    default:
      return false;
  }
}

type AnswerKey = Pick<Question, 'correct' | 'choices' | 'format'>;

export function isAnswerComplete(question: AnswerKey, selected: readonly string[]) {
  return (
    selected.length === question.correct.length &&
    new Set(selected).size === selected.length &&
    selected.every((id) => question.choices.some((choice) => choice.id === id))
  );
}

export function isCorrectAnswer(question: AnswerKey, selected: readonly string[]) {
  if (!isAnswerComplete(question, selected)) return false;
  return question.format
    ? question.correct.every((id, index) => id === selected[index])
    : question.correct.every((id) => selected.includes(id));
}
export function parseQuestions(value: unknown): Question[] {
  if (!Array.isArray(value) || !value.length) throw new Error('問題データが空です。');
  const questions = value as Question[];
  const ids = new Set<string>();
  for (const question of questions) {
    if (
      !question ||
      !text(question.id) ||
      ids.has(question.id) ||
      (question.examDomain !== undefined && !text(question.examDomain)) ||
      (question.similarityGroup !== undefined &&
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(question.similarityGroup)) ||
      !Number.isSafeInteger(question.revision) ||
      question.revision < 1 ||
      ![
        question.category,
        question.version,
        question.title,
        question.prompt,
        question.source?.label,
      ].every(text) ||
      !text(question.source?.url) ||
      !question.source.url.startsWith('https://') ||
      (question.references !== undefined &&
        (!Array.isArray(question.references) ||
          !question.references.every(
            (reference) =>
              reference &&
              [reference.url, reference.label].every(text) &&
              reference.url.startsWith('https://'),
          ))) ||
      (question.learning !== undefined &&
        ![question.learning?.reason, question.learning?.concept].every(text)) ||
      (question.learning?.check !== undefined &&
        ![question.learning.check?.prompt, question.learning.check?.answer].every(text)) ||
      !Array.isArray(question.choices) ||
      question.choices.length < 2 ||
      !question.choices.every(
        (choice) => choice && [choice.id, choice.text, choice.explanation].every(text),
      ) ||
      new Set(question.choices.map((choice) => choice.id)).size !== question.choices.length ||
      !Array.isArray(question.correct) ||
      !question.correct.length ||
      new Set(question.correct).size !== question.correct.length ||
      !question.correct.every((id) => question.choices.some((choice) => choice.id === id)) ||
      !validQuestionFormat(question)
    ) {
      throw new Error('invalidQuestionData');
    }
    ids.add(question.id);
  }
  return questions;
}

export async function loadQuestions(filename: string): Promise<Question[]> {
  const response = await fetch(`/${filename}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error('loadQuestionError');
  return parseQuestions(await response.json());
}
