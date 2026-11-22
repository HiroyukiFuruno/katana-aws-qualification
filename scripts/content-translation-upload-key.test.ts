import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('upload target keys do not become keys possessed by users', () => {
  const source =
    '認証されていない利用者のアップロードや、指定したキー以外へのアップロードまで許してしまう。';
  expect(() =>
    validateTranslation(
      source,
      'This would let unauthenticated users or users with other keys perform operations.',
      'en',
      'fixture',
    ),
  ).toThrow('upload target key terminology');
  expect(() =>
    validateTranslation(
      source,
      'This would allow unauthenticated users to upload objects, including to keys other than the designated key.',
      'en',
      'fixture',
    ),
  ).not.toThrow();
});

test('actual user-held keys and official Traditional Chinese object-key terminology remain valid', () => {
  expect(() =>
    validateTranslation(
      '別の暗号キーを持つ利用者を識別する。',
      'Identify users with other keys.',
      'en',
      'fixture',
    ),
  ).not.toThrow();
  expect(() =>
    validateTranslation(
      '指定したキー以外へのアップロードを許す。',
      '允許上傳至指定物件金鑰以外的金鑰。',
      'zh-TW',
      'fixture',
    ),
  ).not.toThrow();
});
