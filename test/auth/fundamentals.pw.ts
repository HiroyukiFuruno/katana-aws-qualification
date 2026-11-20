import { expect, type Page, test } from '@playwright/test';
import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';
import {
  finishLessonFinal,
  lessonAssets,
  lessonCatalogCard,
  nextButton,
  selectLessonAnswer,
  walkLessonReading,
} from '../progress/fundamentals.helpers';
import { acceptNecessaryCookies } from '../progress/fundamentals-mobile.helpers';

async function openConsentedLesson(page: Page, asset: DeliveryUnitAsset) {
  await page.goto('/ja/study/fundamentals/');
  await acceptNecessaryCookies(page);
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
  const card = lessonCatalogCard(page, asset);
  await card.getByRole('link').click();
  const first = asset.steps[0];
  if (!first) throw new Error('Missing first lesson step.');
  await expect(page).toHaveURL(new RegExp(`${stepHref('ja', first, asset)}$`));
}

for (const asset of lessonAssets) {
  test(`${asset.unit.id}: reading, checkpoints and one final attempt`, async ({ page }) => {
    await openConsentedLesson(page, asset);
    await walkLessonReading(page, asset);
    expect(
      [
        ...new Set(
          asset.finalQuestions.map(
            (question) => `${question.selectionPolarity}:${question.requiredChoices}`,
          ),
        ),
      ].sort(),
    ).toEqual(['correct:1', 'correct:2', 'incorrect:1', 'incorrect:2']);
    await finishLessonFinal(page, asset, 10);
    await expect(page.locator('.lesson-result-pass')).toBeVisible();
    await expect(page.locator('.lesson-result-questions > details')).toHaveCount(12);
    await page.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
    const card = lessonCatalogCard(page, asset);
    await expect(card.locator('.lesson-catalog-status-passed')).toBeVisible();
    await page.reload();
    await expect(card.locator('.lesson-catalog-status-passed')).toBeVisible();
  });
}

test('every published catalog unit offers a resume link', async ({ page }) => {
  await page.goto('/ja/study/fundamentals/');
  await acceptNecessaryCookies(page);
  await expect(page.locator('.lesson-catalog-card')).toHaveCount(lessonAssets.length);
  for (const asset of lessonAssets) {
    const card = lessonCatalogCard(page, asset);
    await expect(card.getByRole('link', { name: /学ぶ|続ける/ })).toBeVisible();
  }
});

test('related reading keeps an ungraded and graded checkpoint selection', async ({ page }) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing fundamentals asset.');
  const checkpoint = asset.steps.find((step) => step.kind === 'checkpoint');
  if (!checkpoint) throw new Error('Missing checkpoint step.');
  await openConsentedLesson(page, asset);
  for (const step of asset.steps.filter((candidate) => candidate.kind !== 'final')) {
    if (step.id === checkpoint.id) break;
    await nextButton(page).click();
  }
  const question = asset.checkpoints.find((candidate) => candidate.id === checkpoint.assessmentId);
  if (!question) throw new Error('Missing checkpoint question.');
  const related = page.locator('.lesson-related-reading');
  await expect(related).toBeVisible();
  await selectLessonAnswer(page, question, question.correct);
  const selected = page.locator('fieldset input:checked');
  await related.locator('summary').click();
  await expect(related.locator('.lesson-related-content')).toBeVisible();
  await related.locator('summary').click();
  await expect(selected).toHaveCount(question.correct.length);
  await page.getByRole('button', { name: '回答を確認', exact: true }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await related.locator('summary').click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(selected).toHaveCount(question.correct.length);
  expect(question.choices.length).toBeGreaterThan(1);
});

test('final selection remains ungraded while related reading is toggled', async ({ page }) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing fundamentals asset.');
  await openConsentedLesson(page, asset);
  await walkLessonReading(page, asset);
  await nextButton(page).click();
  const question = asset.finalQuestions[0];
  if (!question) throw new Error('Missing final question.');
  for (const id of question.correct) {
    const index = question.choices.findIndex((choice) => choice.id === id);
    await page.locator('fieldset input').nth(index).check();
  }
  const related = page.locator('.lesson-related-reading');
  await related.locator('summary').click();
  await related.locator('summary').click();
  await expect(page.locator('fieldset input:checked')).toHaveCount(question.correct.length);
  await expect(page.getByRole('button', { name: '次へ', exact: true })).toBeEnabled();
});

test('a new retry does not replace the submitted result review', async ({ page }) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing fundamentals asset.');
  await openConsentedLesson(page, asset);
  await walkLessonReading(page, asset);
  await finishLessonFinal(page, asset, 10);
  const firstSummary = await page
    .locator('.lesson-result-question')
    .first()
    .locator('summary')
    .textContent();
  await page.getByRole('button', { name: 'もう一度受験する', exact: true }).click();
  await expect(page).toHaveURL(/\/final\/1\/$/);
  await page.goBack();
  await expect(page.locator('.lesson-result-question').first().locator('summary')).toHaveText(
    firstSummary ?? '',
  );
  await expect(page.locator('.lesson-result-question')).toHaveCount(12);
});

test('catalog navigation opens the first slide and preserves fixed step metadata', async ({ page }) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing fundamentals asset.');
  await page.goto('/ja/study/fundamentals/');
  await acceptNecessaryCookies(page);
  const card = lessonCatalogCard(page, asset);
  await card.getByRole('link').click();
  const first = asset.steps[0];
  if (!first) throw new Error('Missing first lesson step.');
  await expect(page).toHaveURL(new RegExp(`${stepHref('ja', first, asset)}$`));
  await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${asset.totalSteps}`);
  await expect(page.getByRole('heading', { name: first.label, exact: true })).toBeFocused();
  await expect(nextButton(page)).toBeEnabled();
});
