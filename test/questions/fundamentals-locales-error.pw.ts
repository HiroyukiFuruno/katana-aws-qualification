import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type {
  DeliveryIndexAsset,
  DeliveryUnitAsset,
} from '../../src/fundamentals/delivery/artifactTypes';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { messages } from '../../src/messages';
import { lessonAssets } from '../progress/fundamentals.helpers';
import { openLocalizedLessonCatalogFixture } from './fundamentals-locale-helpers';

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
