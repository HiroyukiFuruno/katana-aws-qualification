import { expect, test } from 'bun:test';
import {
  applyNarrativeUnit,
  assertLessonNarrativeAlignment,
  narrativeUnits,
} from './fundamentals-translation-data';
import { schemaFor, targetLocalesFor } from './natural-translation-schema';
import { changedTranslationNumbers } from './translation-numbers';

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

test('lesson translations reject shifted headings and omitted or duplicated paragraphs', () => {
  const [unit] = narrativeUnits({
    id: 'slide-1',
    kind: 'reading',
    label: '接続の確認',
    blocks: [
      { label: '接続の確認', text: '接続先のポートを確かめます。' },
      { label: '接続の確認', text: '呼び出し元の許可を確かめます。' },
    ],
  });
  const label = 'Checking a connection';
  const ports = 'Check the destination port.';
  const access = 'Check the permissions of the caller.';
  const check = (texts: string[]) => assertLessonNarrativeAlignment(unit, texts, 'en');
  expect(() => check([label, label, ports, label, access])).not.toThrow();
  expect(() => check([label, label, ports, access, label])).toThrow(
    'Same lesson label has different translations',
  );
  expect(() => check([label, label, ports, label, label])).toThrow(
    'Lesson heading appears in a paragraph',
  );
  expect(() => check([label, label, ports, label, ports])).toThrow(
    'Different lesson paragraphs have the same translation',
  );
});

test('does not mistake subnet divisions or Korean address labels for elapsed time', () => {
  expect(
    changedTranslationNumbers(
      '4分割します。作業には10分かかります。',
      '4개로 나눕니다. 작업에는 11분이 걸립니다.',
      'ko',
    ),
  ).toEqual(['seconds:600']);
  expect(
    changedTranslationNumbers(
      '作業には10分かかります。/24 のアドレス範囲を確認します。',
      '작업에는 11분이 걸립니다. /24 주소 범위를 확인합니다.',
      'ko',
    ),
  ).toEqual(['seconds:600']);
});
