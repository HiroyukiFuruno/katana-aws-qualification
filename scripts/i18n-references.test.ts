import { expect, test } from 'bun:test';
import { translationReferences } from './i18n-references';

test('translation references include nested JSX, escaped and numbered keys', () => {
  expect(
    translationReferences(
      `export function Nested() { return <p title={t('label2')}>{t('label\\u0041')}</p>; }`,
      'src/nested/Component.tsx',
    ),
  ).toEqual(['label2', 'labelA']);
});

test('comments, raw prose and unrelated call names are not translation references', () => {
  expect(
    translationReferences(`// t('comment')\nconst text = "t('prose')"; other('value');`, 'data.ts'),
  ).toEqual([]);
});
