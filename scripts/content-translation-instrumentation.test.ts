import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';

const source = 'CloudWatchのアラームを使い、新しく計装することなく設定する。';
test('software instrumentation is not translated as physical instrument inspection', () => {
  expect(() =>
    assertNativeLanguage(
      source,
      '使用 CloudWatch 警示，在不新增儀器檢測的情況下設定。',
      'zh-TW',
      'alarm.prompt',
    ),
  ).toThrow('software instrumentation terminology');
});

test('accepts software monitoring prose and scopes the rule to software instrumentation', () => {
  expect(() =>
    assertNativeLanguage(
      source,
      '使用 CloudWatch 警示，在不新增監測程式碼的情況下設定。',
      'zh-TW',
      'alarm.prompt',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      '研究室で物理装置の検査をする。',
      '在實驗室進行儀器檢測。',
      'zh-TW',
      'laboratory.prompt',
    ),
  ).not.toThrow();
});
