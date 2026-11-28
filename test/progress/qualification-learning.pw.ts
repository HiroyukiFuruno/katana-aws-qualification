import { expect, type Locator, test } from '@playwright/test';
import { answerExamQuestion, expectGuestKeys } from './guest-exam.helpers';
import { qualificationLearningCases } from './qualification-learning.cases';

const figureAsset = '/qualification-learning/figures/';
const figure = '.qualification-figure';

async function expectTeachingFigure(lessonFigure: Locator) {
  await expect(lessonFigure).toHaveAttribute('lang', 'en');
  await expect(lessonFigure.getByRole('img')).toHaveAttribute('src', new RegExp(figureAsset));
  await expect
    .poll(() => lessonFigure.getByRole('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
}

test.use({ viewport: { width: 390, height: 844 } });

for (const {
  courseId,
  firstTitle,
  nextUnit,
  prompt,
  answer,
  choiceCount,
  figureInNextUnit,
} of qualificationLearningCases) {
  test(`${courseId} teaches and checks understanding before the separate mock exam`, async ({
    page,
  }) => {
    const learningIndex = `/ja/study/${courseId}/learn/`;
    await page.goto(learningIndex);
    const necessaryCookies = page.getByRole('button', { name: '必要なもののみ' });
    await necessaryCookies.click();
    await page.getByRole('link', { name: new RegExp(firstTitle) }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(firstTitle);
    const lessonFigure = page.locator(figure).first();
    if (!figureInNextUnit) await expectTeachingFigure(lessonFigure);
    const question = page.getByRole('group', { name: prompt });
    const form = page.locator('form').filter({ has: question });
    const grade = form.getByRole('button', { name: '回答を確認' });
    await expect(grade).toBeDisabled();
    await question.getByRole('radio', { name: answer, exact: true }).check();
    await grade.click();
    await expect(form.getByRole('status')).toHaveText('正解');
    await expect(question.locator('.choice-wrap > p')).toHaveCount(choiceCount);
    await expectGuestKeys(page);

    const next = page.locator(`.qualification-related a[href$="/${nextUnit}/"]`);
    await next.click();
    await expect(page).toHaveURL(`${learningIndex}${nextUnit}/`);
    if (figureInNextUnit) await expectTeachingFigure(lessonFigure);
    if (courseId === 'saa-c03') {
      await expect(
        page.locator('.qualification-related a[href$="/learn/secure-architecture/"]'),
      ).toHaveText(firstTitle);
    }
    await page.goto(learningIndex);
    const examRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes(figureAsset)) examRequests.push(request.url());
    });
    await page.getByRole('main').getByRole('link', { name: '模擬試験', exact: true }).click();
    await expect(page).toHaveURL(`/ja/study/${courseId}/?mode=exam`);
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
}
