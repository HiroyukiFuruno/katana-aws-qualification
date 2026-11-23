import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import {
  finishLessonFinal,
  lessonAssets,
  nextButton,
  selectLessonAnswer,
} from '../progress/fundamentals.helpers';
import {
  expectPlacements,
  grantAdvertisingConsent,
  selectIncorrectAnswer,
  viewports,
} from './learning.helpers';

const [asset] = lessonAssets;

for (const [name, width] of viewports) {
  test(`fundamentals reading keeps one compact, closable inline advertisement at ${name} width`, async ({
    page,
  }) => {
    if (!asset) throw new Error('Missing fundamentals lesson asset.');
    await page.setViewportSize({ width, height: 812 });
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await expect(page.locator('.site-ad')).toHaveCount(0);
    await grantAdvertisingConsent(page);
    await expectPlacements(page, width);

    const ad = page.locator('.lesson-slide-content > .site-ad--inline');
    await expect(ad).toHaveCount(1);
    await expect(ad).toHaveCSS('border-top-style', 'none');
    await expect(ad).toHaveCSS('border-bottom-style', 'none');
    await expect(ad.getByRole('button', { name: '広告を閉じる' })).toHaveCSS('width', '44px');
    await ad.getByRole('button', { name: '広告を閉じる' }).click();
    await expect(ad).toHaveCount(0);
    await expect(page.locator('.lesson-slide-actions > button.primary')).toBeVisible();
  });

  test(`fundamentals checkpoint, final question, and result keep the inline advertisement at ${name} width`, async ({
    page,
  }) => {
    if (!asset) throw new Error('Missing fundamentals lesson asset.');
    await page.setViewportSize({ width, height: 812 });
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await grantAdvertisingConsent(page);

    for (const step of asset.steps.filter((candidate) => candidate.kind !== 'final')) {
      await expectPlacements(page, width);
      if (step.kind === 'checkpoint') {
        const question = asset.checkpoints.find((candidate) => candidate.id === step.assessmentId);
        if (!question) throw new Error('Missing checkpoint fixture.');
        await selectLessonAnswer(page, question, question.correct);
        await page.getByRole('button', { name: '回答を確認', exact: true }).click();
        await expect(page.getByRole('status')).toContainText('正解');
      }
      await expect(nextButton(page)).toBeEnabled();
      await nextButton(page).click();
    }

    await expectPlacements(page, width);
    await nextButton(page).click();
    await expect(page.locator('fieldset')).toBeVisible();
    await expectPlacements(page, width);
    await finishLessonFinal(page, asset, 12, { start: false });
    await expectPlacements(page, width);
  });

  test(`course settings keeps the shared advertisement at ${name} width`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/ja/study/saa-c03/?mode=settings');
    await expect(page.locator('.site-ad')).toHaveCount(0);
    await grantAdvertisingConsent(page);
    await expectPlacements(page, width);
  });

  test(`normal study and review keep their single inline advertisement at ${name} width`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/ja/study/clf-c02/');
    await grantAdvertisingConsent(page);
    await page.locator('.question-set-picker select').nth(1).selectOption('1');
    await page.getByRole('button', { name: '学習を始める', exact: true }).click();

    const inFlowAd = page.locator('.progress + .site-ad--inline');
    await expect(inFlowAd).toHaveCount(1);
    await expectPlacements(page, width);
    await expect(page.locator('input[name="answer"]').first()).toBeVisible();
    await expect(page.locator('main > .site-ad--inline')).toHaveCount(0);

    await selectIncorrectAnswer(page);
    await page.getByRole('button', { name: '採点する', exact: true }).click();
    await expect(
      page.locator('section[aria-labelledby="question-title"] [role="status"]'),
    ).toContainText('不正解');
    await page.getByRole('button', { name: '結果を見る', exact: true }).click();
    await expect(page.getByRole('heading', { name: '今回の結果', exact: true })).toBeVisible();
    await expectPlacements(page, width);

    await page.getByRole('button', { name: '誤回答', exact: true }).click();
    await page.getByRole('button', { name: '復習を始める', exact: true }).click();
    await expect(page.locator('.progress + .site-ad--inline')).toHaveCount(1);
    await expectPlacements(page, width);
    await selectIncorrectAnswer(page);
    await page.getByRole('button', { name: '採点する', exact: true }).click();
    await page.getByRole('button', { name: '結果を見る', exact: true }).click();
    await expect(page.getByRole('heading', { name: '今回の結果', exact: true })).toBeVisible();
    await expectPlacements(page, width);
  });

  test(`mock examination keeps its single inline advertisement at ${name} width`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/ja/study/saa-c03/?mode=exam');
    await grantAdvertisingConsent(page);
    await page.locator('.exam-format-picker select').selectOption('custom');
    await page.locator('.exam-format-picker input[type="number"]').fill('1');
    await page.getByRole('button', { name: '模擬試験を開始', exact: true }).click();

    await expect(page.locator('.exam-bar ~ .site-ad--inline')).toHaveCount(1);
    await expectPlacements(page, width);
    await expect(page.locator('input[name="exam-answer"]').first()).toBeVisible();
    await expect(page.locator('main > .site-ad--inline')).toHaveCount(0);
    await page.getByRole('button', { name: '試験を提出する', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する', exact: true }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果', exact: true })).toBeVisible();
    await expectPlacements(page, width);
  });
}
