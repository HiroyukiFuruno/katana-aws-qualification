import { readFile, rename } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type {
  DeliveryIndexAsset,
  DeliveryUnitAsset,
} from '../../src/fundamentals/delivery/artifactTypes';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';
import { messages } from '../../src/messages';
import {
  lessonAssets,
  lessonSlideCount,
  nextButton,
  selectLessonAnswer,
  visibleLessonSteps,
} from '../progress/fundamentals.helpers';
import {
  openLocalizedLessonCatalogFixture,
  openLocalizedLessonFixture,
} from './fundamentals-locale-helpers';

test('failed lesson content displays a localized error and recovers over the real network', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing real lesson fixture.');
  const slug = asset.unit.id.replace(/^fundamentals\./, '');
  const localized: DeliveryUnitAsset = JSON.parse(
    await readFile(
      new URL(`../../public/translations/en/fundamentals/delivery/${slug}.json`, import.meta.url),
      'utf8',
    ),
  );
  const index: DeliveryIndexAsset = JSON.parse(
    await readFile(
      new URL('../../public/translations/en/fundamentals/delivery/index.json', import.meta.url),
      'utf8',
    ),
  );
  const catalogUnit = index.units.find((unit) => unit.unitId === asset.unit.id);
  if (!catalogUnit) throw new Error('Missing real English catalog unit.');
  const first = localized.steps[0];
  if (!first) throw new Error('Missing real English reading step.');
  await openLocalizedLessonCatalogFixture(page, 'en');
  await expect(page.locator('.lesson-catalog-card h2').first()).toHaveText(catalogUnit.title);
  await page.context().setOffline(true);
  const href = lessonPath({ locale: 'en', unitId: asset.unit.id, stage: 'resume' });
  await page.locator(`.lesson-catalog-card a[href="${href}"]`).click();
  await expect(page.getByRole('alert')).toHaveText(messages.en.fundamentalsLoadError);
  await expect(page.locator('.lesson-reading')).not.toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole('button', { name: messages.en.fundamentalsReload, exact: true }).click();
  await expect(page.locator('.lesson-slide-content h1')).toHaveText(first.label);
  for (const block of first.blocks)
    await expect(page.locator('.lesson-reading')).toContainText(block.text);
  expect(await page.locator('.lesson-slide-content').textContent()).not.toMatch(
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  );
  expect(errors).toEqual([]);
});

test('failed localized lesson asset keeps an in-progress answer through retry', async ({ page }) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing real lesson fixture.');
  const checkpointPosition = asset.steps.findIndex((step) => step.kind === 'checkpoint');
  const checkpoint = asset.steps[checkpointPosition];
  if (checkpoint?.kind !== 'checkpoint') throw new Error('Missing real lesson checkpoint.');
  const question = asset.checkpoints.find((item) => item.id === checkpoint.assessmentId);
  if (!question) throw new Error('Missing real lesson checkpoint question.');
  const slug = asset.unit.id.replace(/^fundamentals\./, '');
  const localizedPath = new URL(
    `../../public/translations/en/fundamentals/delivery/${slug}.json`,
    import.meta.url,
  );
  const hiddenPath = new URL(`${localizedPath.pathname}.pr107-unavailable`, localizedPath);
  await openLocalizedLessonFixture(page, asset);
  const beforeCheckpoint = visibleLessonSteps(asset).filter(
    (step) => step.position < checkpoint.position,
  );
  for (const position of beforeCheckpoint.keys()) {
    await expect(page.locator('.lesson-slide-meta')).toContainText(
      `STEP ${position + 1} / ${lessonSlideCount(asset)}`,
    );
    await nextButton(page).click();
  }
  await selectLessonAnswer(page, question, question.correct);
  for (const id of question.correct)
    await expect(page.locator(`fieldset input[name="${question.id}"][value="${id}"]`)).toBeChecked();

  let hidden = false;
  try {
    await rename(localizedPath, hiddenPath);
    hidden = true;
    await page.evaluate(
      (href) => {
        history.pushState(null, '', href);
        dispatchEvent(new PopStateEvent('popstate'));
      },
      stepHref('en', checkpoint, asset),
    );
    await expect(page.getByRole('alert')).toHaveText(messages.en.fundamentalsLoadError);
    for (const id of question.correct)
      await expect(page.locator(`fieldset input[name="${question.id}"][value="${id}"]`)).toBeChecked();

    await rename(hiddenPath, localizedPath);
    hidden = false;
    await page.getByRole('button', { name: messages.en.fundamentalsReload, exact: true }).click();
    for (const id of question.correct)
      await expect(page.locator(`fieldset input[name="${question.id}"][value="${id}"]`)).toBeChecked();
  } finally {
    if (hidden) await rename(hiddenPath, localizedPath);
  }
});
