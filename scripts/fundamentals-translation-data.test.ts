import { expect, test } from 'bun:test';
import { applyNarrativeUnit, narrativeUnits } from './fundamentals-translation-data';
import { schemaFor, targetLocalesFor } from './natural-translation-schema';

test('lesson translation groups complete question context while preserving grading and source URLs', () => {
  const question = {
    id: 'q',
    prompt: '誤っているものはどれか。',
    correct: ['B'],
    category: '分類',
    choices: [
      { id: 'A', text: '正しい。', explanation: '説明A。' },
      { id: 'B', text: '誤り。', explanation: '説明B。' },
    ],
    source: { label: '資料名', url: 'https://example.com' },
  };
  const units = narrativeUnits({ questions: [question] });
  expect(units).toHaveLength(1);
  expect(units[0].context).toEqual(question);
  expect(units[0].fields.map((field) => field.path.join('.'))).toEqual([
    'prompt',
    'choices.0.text',
    'choices.0.explanation',
    'choices.1.text',
    'choices.1.explanation',
    'source.label',
  ]);
  const clone = structuredClone({ questions: [question] });
  applyNarrativeUnit(clone, units[0], [
    'Which is incorrect?',
    'Correct.',
    'Reason A.',
    'Incorrect.',
    'Reason B.',
    'Source',
  ]);
  expect(clone.questions[0].correct).toEqual(['B']);
  expect(clone.questions[0].choices.map((choice) => choice.id)).toEqual(['A', 'B']);
  expect(clone.questions[0].source.url).toBe(question.source.url);
  expect(clone.questions[0].prompt).toBe('Which is incorrect?');
});

test('lesson slide text and labels are localized without changing navigation references', () => {
  const source = {
    steps: [
      {
        id: 'slide-1',
        kind: 'intro',
        label: '概要',
        blocks: [{ label: '確認', text: '本文', contentRef: 'unit:summary' }],
        sources: [{ label: '出典', url: 'https://example.com' }],
      },
    ],
  };
  const units = narrativeUnits(source);
  expect(units).toHaveLength(1);
  expect(units[0].fields).toHaveLength(4);
  expect(units[0].fields.every((field) => !field.path.includes('contentRef'))).toBe(true);
});

test('English originals request Japanese and every other supported target language', () => {
  expect(targetLocalesFor('en')).toContain('ja');
  expect(targetLocalesFor('en')).not.toContain('en');
  expect(targetLocalesFor('en')).toHaveLength(9);
  expect(schemaFor('en').properties.locales.required).toEqual(targetLocalesFor('en'));
});
