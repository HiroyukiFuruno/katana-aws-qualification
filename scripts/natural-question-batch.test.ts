import { expect, test } from 'bun:test';
import type { Question } from '../src/questions';
import { validateNaturalQuestionBatch } from './natural-question-batch';

const source: Question[] = [
  {
    id: 'api-query-fixture',
    revision: 1,
    category: '開発',
    version: '2026',
    title: '検索',
    prompt: 'DynamoDBをQueryして結果を返す。',
    choices: [
      { id: 'A', text: 'Scanを実行する。', explanation: '全件を読み取る。' },
      { id: 'B', text: '条件で検索する。', explanation: '必要な範囲を読む。' },
    ],
    correct: ['B'],
    source: { url: 'https://example.com/docs', label: '資料' },
  },
];
const translations = () => ({
  en: [
    {
      id: source[0].id,
      title: 'Lookup',
      prompt: 'Read DynamoDB using Query.',
      choices: [
        { id: 'A', text: 'Run Scan.', explanation: 'Reads every item.' },
        { id: 'B', text: 'Look up by condition.', explanation: 'Reads the required range.' },
      ],
      learning: null,
      prompts: null,
      references: null,
      categoryLabel: 'Development',
      examDomainLabel: 'Development',
      versionLabel: '2026',
      sourceLabel: 'Documentation',
    },
  ],
  fr: [
    {
      id: source[0].id,
      title: 'Recherche',
      prompt: 'Interroger DynamoDB avec Query.',
      choices: [
        { id: 'A', text: 'Exécuter Scan.', explanation: 'Lit tous les éléments.' },
        { id: 'B', text: 'Rechercher selon une condition.', explanation: 'Lit la plage nécessaire.' },
      ],
      learning: null,
      prompts: null,
      references: null,
      categoryLabel: 'Développement',
      examDomainLabel: 'Développement',
      versionLabel: '2026',
      sourceLabel: 'Documentation',
    },
  ],
});

test('batch retry feedback includes errors from every locale instead of just the first', () => {
  const value = translations();
  value.en[0].prompt = 'Read DynamoDB.';
  value.fr[0].choices[0].text = 'Lire tous les éléments.';
  try {
    validateNaturalQuestionBatch(source, value, ['en', 'fr']);
    throw new Error('Expected missing API identifiers to be rejected');
  } catch (error) {
    expect(String(error)).toContain('api-query-fixture/en.prompt: technical token lost: Query');
    expect(String(error)).toContain('api-query-fixture/fr.choices[0].text: technical token lost: Scan');
  }
});

test('batch validation accepts complete translations and reports missing locale output', () => {
  expect(() => validateNaturalQuestionBatch(source, translations(), ['en', 'fr'])).not.toThrow();
  expect(() => validateNaturalQuestionBatch(source, { en: [] }, ['en', 'fr'])).toThrow(
    'fr: natural translation changed batch length',
  );
});
