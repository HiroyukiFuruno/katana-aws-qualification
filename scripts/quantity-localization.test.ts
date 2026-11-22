import { expect, test } from 'bun:test';
import {
  formatQuantityMessage,
  type QuantityVariantData,
  quantityVariantData,
  validateQuantityVariants,
} from '../src/locales/quantity';
import { quantityVariantRequirements } from '../src/locales/quantity-requirements';
import { messages } from '../src/messages';

function format(
  locale: keyof typeof messages,
  key: keyof typeof messages.en,
  values: Record<string, number>,
) {
  return formatQuantityMessage(locale, key, messages[locale][key], values).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(values[name]),
  );
}

test('0件は既存の自然な複数表現を保持する', () => {
  expect(format('fr', 'lessonStepsRemaining', { count: 0 })).toBe('0 étapes restantes');
  expect(format('en', 'lessonStepsRemaining', { count: 0 })).toBe('0 steps remaining');
});

test('全localeのcountとremaining stepは0/1/2で自然に表示する', () => {
  const expected = {
    en: [
      ['0 questions', '1 question', '2 questions'],
      ['0 steps remaining', '1 step remaining', '2 steps remaining'],
    ],
    ja: [
      ['0問', '1問', '2問'],
      ['残り0ステップ', '残り1ステップ', '残り2ステップ'],
    ],
    'zh-CN': [
      ['0 题', '1 题', '2 题'],
      ['剩余 0 步', '剩余 1 步', '剩余 2 步'],
    ],
    'zh-TW': [
      ['0 題', '1 題', '2 題'],
      ['剩餘 0 步', '剩餘 1 步', '剩餘 2 步'],
    ],
    ko: [
      ['0문제', '1문제', '2문제'],
      ['0단계 남음', '1단계 남음', '2단계 남음'],
    ],
    pt: [
      ['0 questões', '1 questão', '2 questões'],
      ['Restam 0 etapas', 'Resta 1 etapa', 'Restam 2 etapas'],
    ],
    fr: [
      ['0 questions', '1 question', '2 questions'],
      ['0 étapes restantes', 'Il reste 1 étape', '2 étapes restantes'],
    ],
    de: [
      ['0 Fragen', '1 Frage', '2 Fragen'],
      ['Noch 0 Schritte', 'Noch 1 Schritt', 'Noch 2 Schritte'],
    ],
    es: [
      ['0 preguntas', '1 pregunta', '2 preguntas'],
      ['Quedan 0 pasos', 'Queda 1 paso', 'Quedan 2 pasos'],
    ],
    it: [
      ['0 domande', '1 domanda', '2 domande'],
      ['0 passaggi rimanenti', 'Rimane 1 passaggio', '2 passaggi rimanenti'],
    ],
  } as const;
  for (const [locale, [labels, steps]] of Object.entries(expected) as [
    keyof typeof messages,
    readonly [readonly string[], readonly string[]],
  ][])
    for (const [count, label] of labels.entries()) {
      expect(format(locale, 'countLabel', { count })).toBe(label);
      expect(format(locale, 'lessonStepsRemaining', { count })).toBe(steps[count]);
    }
});

test('複数operandは文脈上の数量を独立して選ぶ', () => {
  expect(format('en', 'lessonFinalRules', { total: 1, correct: 1 })).toContain(
    '1 question. Pass this attempt with at least 1 correct answer.',
  );
  expect(format('en', 'lessonFinalRules', { total: 2, correct: 1 })).toContain(
    '2 questions. Pass this attempt with at least 1 correct answer.',
  );
  expect(format('en', 'lessonFinalRules', { total: 1, correct: 2 })).toContain(
    '1 question. Pass this attempt with at least 2 correct answers.',
  );
  expect(format('en', 'lessonFinalRules', { total: 2, correct: 2 })).toContain(
    '2 questions. Pass this attempt with at least 2 correct answers.',
  );
  expect(format('fr', 'selectedCount', { selected: 1, count: 2 })).toBe('1 / 2 sélectionnée');
  expect(format('fr', 'glossaryCount', { count: 1, total: 2 })).toBe('1 / 2 termes');
  expect(format('fr', 'glossaryCount', { count: 1, total: 1 })).toBe('1 / 1 terme');
});

test('不足・不正な数量データとoperandを隠さず検出する', () => {
  expect(() => format('en', 'countLabel', {})).toThrow('countLabel requires a finite numeric count');
  expect(() => format('ja', 'countLabel', {})).toThrow('countLabel requires a finite numeric count');
  expect(() => format('en', 'countLabel', { count: Number.NaN })).toThrow(
    'countLabel requires a finite numeric count',
  );
  const invalid = structuredClone(quantityVariantData) satisfies QuantityVariantData;
  const englishCountLabel = invalid.en?.countLabel;
  if (!englishCountLabel) throw new Error('Missing English countLabel fixture');
  englishCountLabel.forms['count=bogus'] = '{count} question';
  expect(() => validateQuantityVariants(invalid, messages)).toThrow('unexpected quantity form');
});

test('必須locale、key、formを削除するとlintが失敗する', () => {
  const missingLocale = structuredClone(quantityVariantData);
  delete missingLocale.fr;
  expect(() => validateQuantityVariants(missingLocale, messages)).toThrow('missing quantity locale: fr');

  const missingKey = structuredClone(quantityVariantData);
  delete missingKey.en?.countLabel;
  expect(() => validateQuantityVariants(missingKey, messages)).toThrow(
    'missing quantity variant: en.countLabel',
  );

  const missingForm = structuredClone(quantityVariantData);
  delete missingForm.en?.lessonFinalRules?.forms['correct:one|total:one'];
  expect(() => validateQuantityVariants(missingForm, messages)).toThrow(
    'missing quantity form: en.lessonFinalRules.correct:one|total:one',
  );

  const malformed = structuredClone(quantityVariantData);
  const finalRules = malformed.en?.lessonFinalRules;
  if (!finalRules) throw new Error('Missing English lessonFinalRules fixture');
  finalRules.forms['correct:one|correct:other'] = finalRules.forms['correct:one|total:one'];
  expect(() => validateQuantityVariants(malformed, messages)).toThrow('unexpected quantity form');
  expect(quantityVariantRequirements.inheritedLocales).toContain('ja');

  const extraKey = structuredClone(quantityVariantData);
  const english = extraKey.en;
  if (!english) throw new Error('Missing English quantity fixture');
  english.position = {
    operands: ['current'],
    forms: { 'current:one': 'Question {current} of {total}' },
  };
  expect(() => validateQuantityVariants(extraKey, messages)).toThrow(
    'unexpected quantity variant: en.position',
  );
});

test('数量と無関係なテンプレートは既存の表示と置換契約を維持する', () => {
  expect(format('en', 'retirement', { date: 20261122 })).toBe('Exam retires 20261122');
});
