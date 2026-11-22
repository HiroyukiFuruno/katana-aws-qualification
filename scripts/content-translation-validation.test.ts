import { expect, test } from 'bun:test';
import { assertDistinctChoices, validateTranslation } from './content-translation-validation';

test('natural French prose preserves masculine agreement when moving messages unchanged', () => {
  expect(() =>
    validateTranslation(
      'メッセージをそのまま移動する。',
      'Déplacer telles quelles les messages.',
      'fr',
      'copy',
    ),
  ).toThrow('French agreement mismatch for messages');
  expect(() =>
    validateTranslation(
      'メッセージをそのまま移動する。',
      'Déplacer tels quels les messages.',
      'fr',
      'copy',
    ),
  ).not.toThrow();
});

const source = {
  id: 'question-1',
  correct: ['B'],
  prompt: 's3:GetObjectを許可する。',
  choices: [{ id: 'B', text: '許可する。' }],
};
const translated = { ...source, prompt: 'Allow s3:GetObject.', choices: [{ id: 'B', text: 'Allow.' }] };

test('localized content preserves canonical IDs and translates displayed fields', () => {
  expect(() => validateTranslation(source, translated, 'en', 'fixture')).not.toThrow();
});

test('localized content rejects swapped answers and untranslated text', () => {
  expect(() => validateTranslation(source, { ...translated, correct: ['A'] }, 'en', 'fixture')).toThrow(
    'canonical identity',
  );
  expect(() => validateTranslation(source, source, 'en', 'fixture')).toThrow('untranslated Japanese');
});

test('localized content rejects missing explanations and changed technical identifiers', () => {
  expect(() =>
    validateTranslation(source, { ...translated, prompt: 'Allow s3:PutObject.' }, 'en', 'fixture'),
  ).toThrow('technical token lost');
  expect(() => validateTranslation(source, { ...translated, choices: [] }, 'en', 'fixture')).toThrow(
    'array length',
  );
});

test('English originals retain technical identifiers when translated into Japanese', () => {
  const original = { prompt: 'Allow s3:GetObject with AWS_REGION.' };
  expect(() =>
    validateTranslation(original, { prompt: 'AWS_REGIONでs3:GetObjectを許可する。' }, 'ja', 'fixture'),
  ).not.toThrow();
  expect(() =>
    validateTranslation(original, { prompt: 'AWS_REGIONでs3:PutObjectを許可する。' }, 'ja', 'fixture'),
  ).toThrow('technical token lost');
});

test('translated assessment options remain distinguishable after normalization', () => {
  const assessment = { options: ['許可する', '拒否する'], correct: 0 };
  expect(() =>
    validateTranslation(
      assessment,
      { options: ['Allow', ' ＡＬＬＯＷ '], correct: 0 },
      'en',
      'assessment',
    ),
  ).toThrow('collapsed distinct choices');
  expect(() =>
    validateTranslation(assessment, { options: ['Allow', 'Deny'], correct: 0 }, 'en', 'assessment'),
  ).not.toThrow();
});

test('narrative question choices reject duplicate translated answers', () => {
  expect(() => assertDistinctChoices([{ text: 'Allow' }, { text: 'allow ' }], 'en', 'lesson')).toThrow(
    'collapsed distinct choices',
  );
});

test('network prefixes and inference container endpoints survive translation exactly', () => {
  const original = { prompt: '10.0.0.0/16と::/0を確認し、/pingと/invocationsを実装する。' };
  const localized = { prompt: 'Check 10.0.0.0/16 and ::/0, then implement /ping and /invocations.' };
  expect(() => validateTranslation(original, localized, 'en', 'network')).not.toThrow();
  for (const token of ['10.0.0.0/16', '::/0', '/ping', '/invocations'])
    expect(() =>
      validateTranslation(
        original,
        { prompt: localized.prompt.replace(token, 'changed') },
        'en',
        'network',
      ),
    ).toThrow('technical token lost');
});

test('a URL followed by Japanese prose does not absorb the surrounding sentence', () => {
  const original = { prompt: 'https://app.exampleへ接続できない。' };
  expect(() =>
    validateTranslation(original, { prompt: 'Cannot connect to https://app.example' }, 'en', 'url'),
  ).not.toThrow();
  expect(() =>
    validateTranslation(original, { prompt: 'Cannot connect to https://other.example' }, 'en', 'url'),
  ).toThrow('technical token lost');
});

test('English-source question prose cannot silently remain English in another locale', () => {
  const original = {
    prompt: 'An application must process each message without changing its original order.',
  };
  expect(() => validateTranslation(original, original, 'fr', 'question')).toThrow(
    'untranslated English prose',
  );
  expect(() =>
    validateTranslation(
      original,
      { prompt: 'Une application doit traiter chaque message sans modifier son ordre initial.' },
      'fr',
      'question',
    ),
  ).not.toThrow();
  expect(() =>
    validateTranslation(
      { text: 'AWS Identity and Access Management' },
      { text: 'AWS Identity and Access Management' },
      'de',
      'name',
    ),
  ).not.toThrow();
});
