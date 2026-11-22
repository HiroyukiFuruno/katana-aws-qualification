import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';

test('Traditional Chinese IAM roles use native assumption terminology', () => {
  const source = 'IAMロールの引受けを許可する。';
  expect(() => assertNativeLanguage(source, '允許引受動作角色。', 'zh-TW', 'text')).toThrow(
    'Traditional Chinese role terminology',
  );
  expect(() => assertNativeLanguage(source, '允許擔任動作角色。', 'zh-TW', 'text')).not.toThrow();
  expect(() =>
    assertNativeLanguage(source, '透過 AssumeRole 擔任 IAM 角色。', 'zh-TW', 'text'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage('保険契約の引受け業務。', '引受保險契約。', 'zh-TW', 'text'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'IAMロールのタグ値「引受」を保つ。',
      '保留 IAM 角色標籤值「引受」。',
      'zh-TW',
      'text',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage('タグ値「引受角色」を保つ。', '保留標籤值「引受角色」。', 'zh-TW', 'text'),
  ).not.toThrow();
});

test('French role assumption is phrased naturally without banning English identifiers', () => {
  const source = 'アクションロールの引受けを許可する。';
  expect(() =>
    assertNativeLanguage(source, 'Autoriser l’assumption du rôle d’action.', 'fr', 'text'),
  ).toThrow('French role assumption terminology');
  expect(() =>
    assertNativeLanguage(source, 'Permettre d’endosser le rôle d’action.', 'fr', 'text'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(source, 'Le rôle du pipeline peut assumer le rôle d’action.', 'fr', 'text'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(source, 'Appeler AssumeRole pour endosser le rôle.', 'fr', 'text'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      source,
      'Le terme anglais « role assumption » désigne cette opération.',
      'fr',
      'text',
    ),
  ).not.toThrow();
  expect(() => assertNativeLanguage(source, 'Allow role assumption.', 'en', 'text')).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'ラベル「assumption du rôle」を保つ。',
      'Conserver le libellé « assumption du rôle ».',
      'fr',
      'text',
    ),
  ).not.toThrow();
});
