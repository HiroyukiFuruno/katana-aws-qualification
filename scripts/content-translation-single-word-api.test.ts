import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('single-word DynamoDB API identifiers remain explicit in translated operations', () => {
  expect(() =>
    validateTranslation(
      '顧客IDでDynamoDBをQueryする。',
      'Interroger DynamoDB par ID client.',
      'fr',
      'fixture',
    ),
  ).toThrow('technical token lost: Query');
  expect(() =>
    validateTranslation(
      '強い整合性のあるScanを先に実行する。',
      'Run a strongly consistent scan first.',
      'en',
      'fixture',
    ),
  ).toThrow('technical token lost: Scan');
  expect(() =>
    validateTranslation(
      '顧客IDでDynamoDBをQueryする。',
      'Interroger DynamoDB par ID client via l’opération Query.',
      'fr',
      'fixture',
    ),
  ).not.toThrow();
});

test('ordinary English query wording can be naturally translated', () => {
  expect(() =>
    validateTranslation('Query optimization', 'Optimisation des requêtes', 'fr', 'fixture'),
  ).not.toThrow();
});
