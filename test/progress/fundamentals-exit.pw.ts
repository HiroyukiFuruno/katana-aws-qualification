import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import {
  lessonAssets,
  lessonCatalogCard,
  lessonSlideCount,
  nextButton,
  selectLessonAnswer,
  visibleLessonQuestion,
  visibleLessonSteps,
  walkLessonReading,
} from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

const asset = lessonAssets[0];
if (!asset) throw new Error('Missing first lesson fixture.');
const exitLabel = '学習を終了';

async function openConsentedGuest(page: Parameters<typeof lessonCatalogCard>[0]) {
  await page.goto('/ja/study/fundamentals/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
}

async function reachFirstCheckpoint(page: Parameters<typeof lessonCatalogCard>[0]) {
  const step = asset.steps.find((candidate) => candidate.kind === 'checkpoint');
  if (step?.kind !== 'checkpoint') throw new Error('Missing checkpoint fixture.');
  const question = asset.checkpoints.find((candidate) => candidate.id === step.assessmentId);
  if (!question) throw new Error('Missing checkpoint question fixture.');
  const positionInDeck = visibleLessonSteps(asset).indexOf(step) + 1;
  for (let position = 1; position < positionInDeck; position += 1) {
    await nextButton(page).click();
    await expect(page.locator('.lesson-slide-meta')).toContainText(
      `STEP ${position + 1} / ${lessonSlideCount(asset)}`,
    );
  }
  return { question, step };
}

test('a consented guest exits reading to the catalog and resumes the same step', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openConsentedGuest(page);
    await lessonCatalogCard(page, asset).getByRole('link').click();
    await nextButton(page).click();
    await expect(page.locator('.lesson-slide-meta')).toContainText(
      `STEP 2 / ${lessonSlideCount(asset)}`,
    );
    await page.getByRole('button', { name: exitLabel, exact: true }).click();
    await expect(page).toHaveURL(/\/study\/fundamentals\/$/);
    await lessonCatalogCard(page, asset).getByRole('link').click();
    await expect(page.locator('.lesson-slide-meta')).toContainText(
      `STEP 2 / ${lessonSlideCount(asset)}`,
    );
  } finally {
    await context.close();
  }
});

test('a revisited checkpoint requires a new confirmation before proceeding', async ({ page }) => {
  await openConsentedGuest(page);
  await lessonCatalogCard(page, asset).getByRole('link').click();
  const { question, step } = await reachFirstCheckpoint(page);
  await expect(nextButton(page)).toBeDisabled();
  await selectLessonAnswer(page, question, question.correct);
  await page.getByRole('button', { name: '回答を確認', exact: true }).click();
  await expect(nextButton(page)).toBeEnabled();
  await nextButton(page).click();
  await page.getByRole('link', { name: '前へ', exact: true }).click();
  await expect(page.locator('.lesson-slide-meta')).toContainText(
    `STEP ${visibleLessonSteps(asset).indexOf(step) + 1} / ${lessonSlideCount(asset)}`,
  );
  await expect(nextButton(page)).toBeDisabled();

  await selectLessonAnswer(page, question, question.correct);
  await page.getByRole('button', { name: '回答を確認', exact: true }).click();
  await expect(nextButton(page)).toBeEnabled();
  await page.getByRole('button', { name: 'もう一度回答', exact: true }).click();
  await expect(nextButton(page)).toBeDisabled();
});

test('a member keeps an in-progress final answer after exiting and resuming', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await setRealSession(page, session);
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await walkLessonReading(page, asset);
    await nextButton(page).click();
    const question = await visibleLessonQuestion(page, asset.finalQuestions);
    await selectLessonAnswer(page, question, [question.correct[0]]);
    await page.getByRole('button', { name: exitLabel, exact: true }).click();
    await expect(page).toHaveURL(/\/study\/fundamentals\/$/);
    await lessonCatalogCard(page, asset).getByRole('link').click();
    await expect(page).toHaveURL(/\/final\/1\/$/);
    await expect(
      page.locator(`fieldset input[name="${question.id}"][value="${question.correct[0]}"]`),
    ).toBeChecked();
  } finally {
    await context.close();
  }
});
