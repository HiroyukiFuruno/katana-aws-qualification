import { expect, test } from 'bun:test';
import { loadQuestions, validateQuestionTranslation } from '../src/questionLocalization';
import { canonical, localizedQuestionFetch } from './question-localization-fixture';

test('localized questions may translate display fields while retaining grading identity', () => {
  const localized = validateQuestionTranslation(canonical, [
    {
      ...canonical[0],
      categoryLabel: 'Category',
      examDomainLabel: 'Domain',
      versionLabel: '2026 edition',
      sourceLabel: 'Localized AWS',
      title: 'Localized title',
      prompt: 'Localized prompt',
      choices: canonical[0].choices.map((choice) => ({ ...choice, text: `Localized ${choice.id}` })),
    },
  ]);
  expect(localized[0].choices[1].id).toBe('B');
  expect(localized[0].correct).toEqual(['B']);
  expect(localized[0].category).toBe('カテゴリ');
  expect(localized[0].categoryLabel).toBe('Category');
  expect(localized[0].source.label).toBe('Localized AWS');
});

test('localized questions reject changed canonical IDs, answer IDs, and grading keys', () => {
  expect(() => validateQuestionTranslation(canonical, [{ ...canonical[0], revision: 2 }])).toThrow(
    'invalidQuestionData',
  );
  expect(() =>
    validateQuestionTranslation(canonical, [
      { ...canonical[0], choices: [...canonical[0].choices].reverse() },
    ]),
  ).toThrow('invalidQuestionData');
  expect(() =>
    validateQuestionTranslation(canonical, [{ ...canonical[0], category: 'translated key' }]),
  ).toThrow('invalidQuestionData');
});

test('non-Japanese banks load a validated overlay and never fall back when it is missing', async () => {
  const originalFetch = globalThis.fetch;
  const fixture = localizedQuestionFetch('courses/test/questions.json', 'en', [
    {
      ...canonical[0],
      categoryLabel: 'Category',
      examDomainLabel: 'Domain',
      versionLabel: '2026',
      sourceLabel: 'AWS',
      title: 'Localized title',
      prompt: 'Localized prompt',
    },
  ]);
  globalThis.fetch = fixture.fetch;
  try {
    await expect(loadQuestions('courses/test/questions.json', 'en')).resolves.toHaveLength(1);
    expect(fixture.requests).toEqual([
      '/courses/test/questions.json',
      '/translations/published-content.v1.json',
      '/translations/en/courses/test/questions.json',
      '/translations/en/manifest.json',
      '/translations/en/payload-manifest.json',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
  try {
    await expect(loadQuestions('courses/test/questions.json', 'en')).rejects.toThrow(
      'loadQuestionError',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an English-source bank serves English canonically and requires a Japanese overlay', async () => {
  const originalFetch = globalThis.fetch;
  const fixture = localizedQuestionFetch('courses/mla-c02/mock-2026-11.json', 'ja', [
    {
      ...canonical[0],
      categoryLabel: 'カテゴリ',
      examDomainLabel: 'ドメイン',
      versionLabel: '2026年版',
      sourceLabel: 'AWS',
      title: '翻訳済みの題名',
      prompt: '翻訳済みの設問',
    },
  ]);
  globalThis.fetch = fixture.fetch;
  try {
    const english = await loadQuestions('courses/mla-c02/mock-2026-11.json', 'en');
    expect(english[0].locale).toBe('en');
    expect(fixture.requests).toEqual(['/courses/mla-c02/mock-2026-11.json']);
    fixture.requests.length = 0;
    const japanese = await loadQuestions('courses/mla-c02/mock-2026-11.json', 'ja');
    expect(japanese[0].locale).toBe('ja');
    expect(fixture.requests).toEqual([
      '/courses/mla-c02/mock-2026-11.json',
      '/translations/published-content.v1.json',
      '/translations/ja/courses/mla-c02/mock-2026-11.json',
      '/translations/ja/manifest.json',
      '/translations/ja/payload-manifest.json',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a translated bank cannot silently reuse untranslated metadata', () => {
  expect(() => validateQuestionTranslation(canonical, canonical)).toThrow('invalidQuestionData');
});

test('localized reference labels retain canonical source URLs', () => {
  const original = {
    ...canonical[0],
    references: [{ url: 'https://docs.aws.amazon.com/reference', label: '参考資料' }],
  };
  const localized = {
    ...original,
    categoryLabel: 'Category',
    examDomainLabel: 'Domain',
    versionLabel: '2026',
    sourceLabel: 'AWS',
    references: [{ ...original.references[0], label: 'Reference' }],
  };
  expect(validateQuestionTranslation([original], [localized])[0].references?.[0].label).toBe(
    'Reference',
  );
  expect(() =>
    validateQuestionTranslation(
      [original],
      [{ ...localized, references: [{ ...localized.references[0], url: 'https://example.com' }] }],
    ),
  ).toThrow('invalidQuestionData');
});
