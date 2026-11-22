import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('French index acronyms retain masculine agreement without changing feminine key nouns', () => {
  expect(() =>
    validateTranslation(
      'GSIのキーに集中する。',
      'Les écritures se concentrent sur la clé de la GSI.',
      'fr',
      'fixture',
    ),
  ).toThrow('index agreement');
  expect(() =>
    validateTranslation('既存のGSIに書き込む。', 'Écrire dans les GSI existantes.', 'fr', 'fixture'),
  ).toThrow('index agreement');
  expect(() =>
    validateTranslation(
      'GSIのキーに集中する。',
      'Les écritures se concentrent sur la clé de l’index GSI.',
      'fr',
      'fixture',
    ),
  ).not.toThrow();
});

test('Portuguese index contractions agree with index while key and partition remain feminine', () => {
  expect(() =>
    validateTranslation(
      'GSIのキー範囲で失敗する。',
      'A chave da GSI está sobrecarregada.',
      'pt',
      'fixture',
    ),
  ).toThrow('index agreement');
  expect(() =>
    validateTranslation('複数のGSIに書き込む。', 'Gravar nas GSIs existentes.', 'pt', 'fixture'),
  ).toThrow('index agreement');
  expect(() =>
    validateTranslation(
      'GSIのキー範囲で失敗する。',
      'A chave do índice GSI está sobrecarregada.',
      'pt',
      'fixture',
    ),
  ).not.toThrow();
});

test('Portuguese sentence-initial indefinite index articles are checked', () => {
  expect(() =>
    validateTranslation('GSIは索引である。', 'Uma GSI representa um índice.', 'pt', 'fixture'),
  ).toThrow('index agreement');
});
