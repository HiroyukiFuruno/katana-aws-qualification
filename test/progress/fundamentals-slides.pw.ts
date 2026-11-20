import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';
import {
  finishLessonFinal,
  lessonAssets,
  lessonPrefix,
  nextButton,
  walkLessonReading,
} from './fundamentals.helpers';

const first = lessonAssets[0];
if (!first) throw new Error('Missing first lesson.');

test('a transient mobile guest keeps slide progress through SPA catalog navigation but not reload', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(lessonPath({ locale: 'ja', unitId: first.unit.id, stage: 'resume' }));
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${first.totalSteps}`);
    await nextButton(page).click();
    await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${first.totalSteps}`);
    const geometry = await page.locator('.lesson-slide-shell').evaluate((shell) => ({
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      height: shell.getBoundingClientRect().height,
      viewportHeight: innerHeight,
    }));
    expect(geometry.width).toBe(geometry.viewport);
    expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight + 2);
    await page.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
    await page.locator('.lesson-catalog-card').first().getByRole('link').click();
    await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${first.totalSteps}`);
    expect(
      await page.evaluate(
        (prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix)),
        lessonPrefix,
      ),
    ).toEqual([]);
    await page.reload();
    await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${first.totalSteps}`);
  } finally {
    await context.close();
  }
});

for (const asset of lessonAssets) {
  test(`all required reading and four checkpoints are reachable for ${asset.unit.id}`, async ({
    page,
  }) => {
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await walkLessonReading(page, asset);
    expect(await page.locator('fieldset').count()).toBe(0);
  });
}

test('a consented guest passes only one complete final attempt and reloads that result', async ({
  page,
}) => {
  await page.goto('/ja/study/fundamentals/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
  await page.locator('.lesson-catalog-card').first().getByRole('link').click();
  await walkLessonReading(page, first);
  await finishLessonFinal(page, first, 10);
  await expect(page.locator('.lesson-result-pass')).toBeVisible();
  await page.reload();
  await expect(page.locator('.lesson-result-pass')).toBeVisible();
  await expect(page.locator('.lesson-result-score')).toContainText('12問中 10問正解');
  await expect(page.locator('.lesson-result-questions > details')).toHaveCount(12);
  await page.goto(
    stepHref(
      'ja',
      first.steps[0] ??
        (() => {
          throw new Error('Missing first step');
        })(),
      first,
    ),
  );
  await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${first.totalSteps}`);
});
