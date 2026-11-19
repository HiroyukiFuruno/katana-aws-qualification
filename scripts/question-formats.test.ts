import { describe, expect, test } from 'bun:test';
import { isAnswered, type ExamDraft } from '../src/exam';
import {
  isAnswerComplete,
  isCorrectAnswer,
  questionKey,
  type Question,
  type StructuredQuestion,
  validQuestionFormat,
} from '../src/questions';

const legacy: Question = {
  id: 'test',
  revision: 1,
  category: '検証',
  version: '1',
  title: '形式の検証',
  prompt: '設問',
  choices: ['A', 'B', 'C', 'D'].map((id) => ({ id, text: id, explanation: id })),
  correct: ['B', 'A'],
  source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
};
const ordered: StructuredQuestion = { ...legacy, format: 'ordering', correct: ['B', 'D', 'A'] };
const matched: StructuredQuestion = {
  ...legacy,
  format: 'matching',
  choices: legacy.choices.slice(0, 3),
  correct: ['B', 'A', 'C'],
  prompts: ['1', '2', '3'].map((id) => ({ id, text: id })),
};

describe('回答種別', () => {
  test('既存の複数回答は選択順を問わない', () => {
    expect(isCorrectAnswer(legacy, ['A', 'B'])).toBe(true);
    expect(isCorrectAnswer(legacy, ['A', 'A'])).toBe(false);
    expect(isCorrectAnswer(legacy, ['B', 'C'])).toBe(false);
  });

  test('並べ替えは正しい候補と位置を判定する', () => {
    expect(validQuestionFormat(ordered)).toBe(true);
    expect(isCorrectAnswer(ordered, ['B', 'D', 'A'])).toBe(true);
    expect(isCorrectAnswer(ordered, ['D', 'B', 'A'])).toBe(false);
    expect(isCorrectAnswer(ordered, ['B', 'C', 'A'])).toBe(false);
    expect(isAnswerComplete(ordered, ['B', '', 'A'])).toBe(false);
  });

  test('組み合わせは正答と項目の対応を判定する', () => {
    expect(validQuestionFormat(matched)).toBe(true);
    expect(isCorrectAnswer(matched, ['B', 'A', 'C'])).toBe(true);
    expect(isCorrectAnswer(matched, ['B', 'C', 'A'])).toBe(false);
    expect(isAnswerComplete(matched, ['B', 'B', 'C'])).toBe(false);
    expect(isAnswerComplete(matched, ['B', 'X', 'C'])).toBe(false);
  });

  test('保存した途中回答は空欄の位置を維持し、完了扱いしない', () => {
    const key = questionKey(matched);
    const partial: ExamDraft = {
      id: 'test-exam',
      deadline: 1000,
      order: [key],
      position: 0,
      responses: { [key]: { selected: ['', 'A', 'C'], durationMs: 0, flagged: false } },
    };
    const restored: ExamDraft = JSON.parse(JSON.stringify(partial));
    expect(restored.responses[key].selected).toEqual(['', 'A', 'C']);
    expect(isAnswered(restored, matched)).toBe(false);
    restored.responses[key].selected[0] = 'B';
    expect(isAnswered(restored, matched)).toBe(true);
  });

  test('項目IDが重複する組み合わせと候補が6個以上の並べ替えを受け付けない', () => {
    expect(
      validQuestionFormat({ ...matched, prompts: [...matched.prompts.slice(0, 2), matched.prompts[0]] }),
    ).toBe(false);
    expect(
      validQuestionFormat({
        ...ordered,
        choices: [
          ...ordered.choices,
          { id: 'E', text: 'E', explanation: 'E' },
          { id: 'F', text: 'F', explanation: 'F' },
        ],
      }),
    ).toBe(false);
  });
});
