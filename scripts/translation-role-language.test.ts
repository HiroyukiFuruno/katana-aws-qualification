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

test('French technical software writers are not translated as human writers', () => {
  const contexts = [
    'AWS Glue and Glue Data Catalog writers use locking.',
    'Athena and Iceberg writers coordinate commit and write operations.',
    'Le catalogue et le verrouillage coordonnent les commits des writers.',
    'AWS Glue ライターとロック、コミットを使う。',
  ];
  for (const source of contexts)
    expect(() =>
      assertNativeLanguage(source, 'Les écrivains gèrent le traitement.', 'fr', 'writer'),
    ).toThrow('French software writer terminology');
});

test('French writer terminology keeps natural process wording and unrelated people', () => {
  expect(() =>
    assertNativeLanguage(
      'Athena et Iceberg utilisent des writers pour les commits.',
      'Athena et Iceberg utilisent un processus d’écriture pour les commits.',
      'fr',
      'writer',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'Un écrivain humain présente son roman.',
      'Un écrivain humain présente son roman.',
      'fr',
      'writer',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'AWS Glue conserve le libellé « écrivain ».',
      'AWS Glue conserve le libellé « écrivain ».',
      'fr',
      'writer',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'Athena et Iceberg utilisent des writers pour les commits.',
      'Athena et Iceberg utilisent des e\u0301crivains pour les commits.',
      'fr',
      'writer',
    ),
  ).toThrow('French software writer terminology');
});

test('French writer guard does not classify ordinary writers as software writers', () => {
  expect(() =>
    assertNativeLanguage(
      'The writer writes novels.',
      'Les écrivains écrivent des romans.',
      'fr',
      'writer',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      '通常のライターが小説を書く。',
      'Les écrivains écrivent des romans.',
      'fr',
      'writer',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'The service writer is enabled.',
      'Les écrivains sont activés.',
      'fr',
      'writer',
    ),
  ).not.toThrow();
});
