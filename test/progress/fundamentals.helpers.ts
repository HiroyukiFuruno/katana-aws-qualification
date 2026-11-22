import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import type { DeliveryQuestion, DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { parseDeliveryIndex } from '../../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../../src/fundamentals/delivery/loadUnit';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';

const root = resolve(import.meta.dirname, '../../public/fundamentals/delivery');
const index = parseDeliveryIndex(JSON.parse(readFileSync(`${root}/index.json`, 'utf8')));
export const lessonAssets = index.units.map((entry) =>
  parseDeliveryUnit(JSON.parse(readFileSync(`${root}/${entry.slug}.json`, 'utf8')), entry),
);
export const lessonPrefix = 'katana.fundamentals-progress.v1.';

export function lessonCatalogCard(page: Page, asset: DeliveryUnitAsset) {
  const href = lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' });
  return page.locator('.lesson-catalog-card').filter({ has: page.locator(`a[href="${href}"]`) });
}

export function nextButton(page: Page) {
  return page.locator('.lesson-slide-actions > button.primary');
}

export async function selectLessonAnswer(page: Page, question: DeliveryQuestion, selected: string[]) {
  for (const id of selected) {
    if (!question.choices.some((choice) => choice.id === id)) throw new Error('Unknown fixture choice.');
    await page.locator(`fieldset input[name="${question.id}"][value="${id}"]`).check();
  }
}

export async function visibleLessonQuestion(page: Page, questions: DeliveryQuestion[]) {
  const questionId = await page.locator('fieldset input').first().getAttribute('name');
  const question = questions.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error(`Unknown displayed lesson question: ${questionId ?? 'missing id'}.`);
  return question;
}

export async function walkLessonReading(page: Page, asset: DeliveryUnitAsset) {
  const plan = asset.steps.filter((step) => step.kind !== 'final');
  for (const step of plan) {
    await expect(page).toHaveURL(new RegExp(`${stepHref('ja', step, asset)}$`));
    await expect(page.locator('.lesson-slide-meta')).toContainText(
      `STEP ${step.position} / ${asset.totalSteps}`,
    );
    await expect(page.locator('.lesson-slide-meta')).toContainText(`残り${step.remainingSteps}ステップ`);
    if (step.kind === 'checkpoint') {
      const question = asset.checkpoints.find((question) => question.id === step.assessmentId);
      if (!question) throw new Error('Missing fixture checkpoint.');
      await selectLessonAnswer(page, question, question.correct);
      await page.getByRole('button', { name: '回答を確認', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('正解');
    }
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();
  }
  await expect(page).toHaveURL(/\/final\/1\/$/);
}

export async function finishLessonFinal(
  page: Page,
  asset: DeliveryUnitAsset,
  correct: number,
  options: { positions?: readonly number[]; start?: boolean } = {},
) {
  const positions = new Set(options.positions ?? Array.from({ length: correct }, (_, index) => index));
  if (positions.size !== correct || [...positions].some((index) => index < 0 || index >= 12)) {
    throw new Error('The final fixture needs distinct valid correct-answer positions.');
  }
  if (options.start !== false) await nextButton(page).click();
  await expect(page.locator('fieldset')).toBeVisible();
  for (const [position] of asset.finalQuestions.entries()) {
    await expect(page).toHaveURL(new RegExp(`/final/${position + 1}/$`));
    const question = await visibleLessonQuestion(page, asset.finalQuestions);
    const wrong = question.choices.find((choice) => !question.correct.includes(choice.id));
    if (!wrong) throw new Error('The final fixture requires a selectable incorrect answer.');
    const canonicalPosition = asset.finalQuestions.findIndex(
      (candidate) => candidate.id === question.id,
    );
    if (canonicalPosition < 0) throw new Error('Unknown displayed final question.');
    const selected = positions.has(canonicalPosition)
      ? question.correct
      : [wrong.id, ...question.correct].slice(0, question.requiredChoices);
    await selectLessonAnswer(page, question, selected);
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();
  }
  await expect(page).toHaveURL(/\/result\/$/);
  await expect(page.locator('.lesson-result-score')).toContainText(`12問中 ${correct}問正解`);
}
