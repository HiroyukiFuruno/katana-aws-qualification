import { expect, test } from '@playwright/test';
import { answerExamQuestion, expectGuestKeys } from './guest-exam.helpers';

const figureAsset = '/qualification-learning/figures/';
const learningIndex = '/ja/study/clf-c02/learn/';
const figure = '.qualification-figure';

test.use({ viewport: { width: 390, height: 844 } });

test('the CLF lesson teaches and checks understanding before the separate mock exam', async ({
  page,
}) => {
  await page.goto(learningIndex);
  const necessaryCookies = page.getByRole('button', { name: '必要なもののみ' });
  await necessaryCookies.click();
  await page.getByRole('link', { name: /クラウドの価値、責任共有、可用性/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('クラウドの価値、責任共有、可用性');
  await expect(page.locator(figure)).toHaveAttribute('lang', 'en');
  await expect(page.locator(figure).getByRole('img')).toHaveAttribute('src', new RegExp(figureAsset));
  await expect
    .poll(() =>
      page
        .locator(figure)
        .getByRole('img')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  const question = page.getByRole('group', { name: /小売会社の運用担当者は/ });
  const form = page.locator('form').filter({ has: question });
  const grade = form.getByRole('button', { name: '回答を確認' });
  await expect(grade).toBeDisabled();
  await question.getByRole('radio', { name: /ゲストオペレーティングシステムに必要な更新/ }).check();
  await grade.click();
  await expect(form.getByRole('status')).toHaveText('正解');
  await expect(question.locator('.choice-wrap > p')).toHaveCount(4);
  await expectGuestKeys(page);

  const next = page.locator('.qualification-related a[href$="/security-and-compliance/"]');
  await next.click();
  await expect(page).toHaveURL(/security-and-compliance\/$/);
  await page.goto(learningIndex);
  const examRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes(figureAsset)) examRequests.push(request.url());
  });
  await page.getByRole('main').getByRole('link', { name: '模擬試験', exact: true }).click();
  await expect(page).toHaveURL(/study\/clf-c02\/\?mode=exam$/);
  await expect(page.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();
  await expect(page.locator(figure)).toHaveCount(0);

  const examPicker = page.locator('.exam-format-picker');
  await examPicker.locator('select').selectOption('custom');
  await examPicker.locator('input[type="number"]').fill('15');
  await examPicker.getByRole('button', { name: '模擬試験を開始' }).click();
  for (let position = 1; position <= 15; position += 1) {
    await expect(page.getByRole('heading', { name: new RegExp(`第${position}問`) })).toBeVisible();
    await expect(page.locator(figure)).toHaveCount(0);
    await answerExamQuestion(page, position);
    if (position < 15) await page.getByRole('button', { name: '次の問題' }).click();
  }
  await page.getByRole('button', { name: '試験を提出する' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
  await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
  await expect(page.locator('.exam-score')).toHaveText(/^15問中 \d+問正解$/);
  await page.getByRole('checkbox', { name: '正解した問題も表示' }).check();
  const solution = page.locator('.exam-solutions details').first();
  await solution.locator('summary').click();
  await expect(solution).toHaveAttribute('open', '');
  await expect(page.locator(figure)).toHaveCount(0);
  await expect(page.locator(`img[src*="${figureAsset}"]`)).toHaveCount(0);
  expect(examRequests).toEqual([]);
  await expectGuestKeys(page);
});
