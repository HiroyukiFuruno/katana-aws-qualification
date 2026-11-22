import { expect, test } from 'bun:test';
import { validateTranslation } from './content-translation-validation';

test('EC2 and Fargate pricing uses compute terminology in English', () => {
  const source =
    'EC2からFargateへ移行しても、一定の利用額へのコミットで計算料金の割引を受けたい。どれを検討する？';
  const literal =
    'Even after migrating from EC2 to Fargate, I would like to receive a discount on calculation fees by committing to a certain usage amount. Which one would you consider?';
  expect(() => validateTranslation(source, literal, 'en', 'assessment.f2')).toThrow(
    'English compute pricing terminology',
  );
  expect(() =>
    validateTranslation(
      source,
      'After migrating from EC2 to Fargate, an organization wants to reduce compute charges by committing to a consistent amount of usage. Which option should it consider?',
      'en',
      'assessment.f2',
    ),
  ).not.toThrow();
});

test('application calculation fees are distinct from AWS compute charges', () => {
  expect(() =>
    validateTranslation(
      'EC2で動く数値計算サービスで、顧客に計算の手数料を請求する。',
      'A numerical calculation service running on EC2 charges customers calculation fees.',
      'en',
      'application-billing',
    ),
  ).not.toThrow();
});
