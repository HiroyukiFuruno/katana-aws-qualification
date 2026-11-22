import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('French stateless network controls do not become stateless persons', () => {
  const source =
    'サブネット境界の通信を制御するルール。ステートレスなので、必要な通信は往路と復路の両方を許可する。';
  expect(() =>
    validateTranslation(
      source,
      "Règles qui contrôlent la communication aux limites du sous-réseau. Puisqu'il est apatride, les communications nécessaires sont autorisées à la fois sortantes et entrantes.",
      'fr',
      'glossary.NACL',
    ),
  ).toThrow('French stateless terminology');
  expect(() =>
    validateTranslation(
      source,
      'Règles qui contrôlent le trafic à la frontière d’un sous-réseau. Elles sont sans état : le trafic nécessaire doit être autorisé dans les deux sens.',
      'fr',
      'glossary.NACL',
    ),
  ).not.toThrow();
});

test('French empty API result labels use a grammatical noun around Items', () => {
  expect(() =>
    validateTranslation('Itemsが空である。', 'La page renvoie un Items vide.', 'fr', 'fixture'),
  ).toThrow('French agreement mismatch for Items');
  expect(() =>
    validateTranslation('Itemsが空である。', 'La page renvoie une liste Items vide.', 'fr', 'fixture'),
  ).not.toThrow();
});

test('French rehosting uses masculine agreement while feminine solution nouns remain valid', () => {
  const source = 'AWS Transform MGNは物理サーバーや仮想サーバーをAWSへリホストする工程を支援する。';
  for (const article of ['la', 'une', 'cette'])
    expect(() =>
      validateTranslation(
        source,
        `AWS Transform MGN prend en charge ${article} réhébergement de serveurs physiques et virtuels sur AWS.`,
        'fr',
        'MGN.learning.reason',
      ),
    ).toThrow('French rehosting agreement');
  for (const translated of [
    'AWS Transform MGN prend en charge le réhébergement de serveurs physiques et virtuels sur AWS.',
    'AWS Transform MGN est une solution de réhébergement de serveurs physiques et virtuels sur AWS.',
    'AWS Transform MGN est la solution de réhébergement choisie pour ces serveurs physiques et virtuels sur AWS.',
  ])
    expect(() => validateTranslation(source, translated, 'fr', 'MGN.learning.reason')).not.toThrow();
  expect(() =>
    validateTranslation(
      source,
      'AWS Transform MGN prend en charge la réhébergement de serveurs physiques et virtuels sur AWS.'.normalize(
        'NFD',
      ),
      'fr',
      'MGN.learning.reason',
    ),
  ).toThrow('French rehosting agreement');
});
