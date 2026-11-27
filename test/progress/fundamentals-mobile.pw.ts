import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { messages } from '../../src/messages';
import {
  lessonAssets,
  lessonSlideCount,
  selectLessonAnswer,
  visibleLessonSteps,
} from './fundamentals.helpers';
import { acceptNecessaryCookies, walkReadingWithGeometry } from './fundamentals-mobile.helpers';

for (const asset of lessonAssets) {
  test(`390px reading geometry remains reachable for ${asset.unit.id}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await acceptNecessaryCookies(page);
    await walkReadingWithGeometry(page, asset);
  });
}

for (const mode of [
  { name: '320px', width: 320, height: 568, zoom: false },
  { name: 'landscape', width: 844, height: 390, zoom: false },
  { name: '200-percent-text', width: 390, height: 844, zoom: true },
]) {
  for (const asset of lessonAssets)
    test(`${mode.name} preserves readable lesson content for ${asset.unit.id}`, async ({ page }) => {
      await page.setViewportSize({ width: mode.width, height: mode.height });
      await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
      await acceptNecessaryCookies(page);
      if (mode.zoom)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%';
        });
      await walkReadingWithGeometry(page, asset);
      await expect(page.locator('.lesson-slide-meta')).toContainText(
        `STEP ${lessonSlideCount(asset) - asset.finalQuestions.length + 1}`,
      );
    });
}

test('a short mobile viewport scrolls the entire lesson and starts the next slide at the top', async ({
  page,
}) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing first lesson fixture.');

  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
  await acceptNecessaryCookies(page);
  const stage = page.locator('.lesson-slide-stage');
  await expect(stage).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '150%';
  });

  const content = page.locator('.lesson-slide-content');
  const contentBox = await content.boundingBox();
  if (!contentBox) throw new Error('Missing lesson content geometry.');
  await page.mouse.move(contentBox.x + 20, contentBox.y + 10);
  await page.mouse.wheel(0, 650);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '学習を終了', exact: true })).toBeInViewport();
  await page.locator('.lesson-slide-actions > button.primary').click();
  const second = visibleLessonSteps(asset)[1];
  await expect(page).toHaveURL(new RegExp(`/slides/${second.position}/$`));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('the introduction opens objectives in place and reaches the first topic with one advance', async ({
  page,
}) => {
  const asset = lessonAssets[0];
  const [intro, topic] = visibleLessonSteps(asset);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
  await acceptNecessaryCookies(page);
  const objectives = page.locator('.lesson-slide-content details').filter({ hasText: '学習目標' });
  await expect(objectives.locator('li')).toHaveCount(4);
  await expect(objectives.locator('li').first()).toBeHidden();
  await objectives.locator('summary').click();
  await expect(objectives.locator('li').first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/slides/${intro.position}/$`));
  await page.locator('.lesson-slide-actions > button.primary').click();
  await expect(page).toHaveURL(new RegExp(`/slides/${topic.position}/$`));
  await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${lessonSlideCount(asset)}`);
  await page.getByRole('link', { name: '前へ', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/slides/${intro.position}/$`));
  await page.locator('.lesson-slide-actions > button.primary').click();
  await expect(page).toHaveURL(new RegExp(`/slides/${topic.position}/$`));
});

test('a long German database lesson shows the comparison first and keeps the full explanation', async ({
  page,
}) => {
  const asset = lessonAssets.find(({ unit }) => unit.id === 'fundamentals.core-services');
  if (!asset) throw new Error('Missing database lesson fixture.');
  const target = asset.steps.find((step) => step.sectionId === 'database' && step.kind === 'reading');
  if (!target) throw new Error('Missing database concept slide.');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(lessonPath({ locale: 'de', unitId: asset.unit.id, stage: 'resume' }));
  await acceptNecessaryCookies(page);
  for (const step of visibleLessonSteps(asset)) {
    if (step.id === target.id) break;
    if (step.kind === 'checkpoint') {
      const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
      if (!question) throw new Error('Missing database checkpoint fixture.');
      await selectLessonAnswer(page, question, question.correct);
      await page.getByRole('button', { name: messages.de.lessonCheckpointSubmit, exact: true }).click();
    }
    await page.locator('.lesson-slide-actions > button.primary').click();
  }
  await expect(page.locator('.lesson-visual-comparison li')).toHaveCount(2);
  const details = page.locator('.lesson-reading details');
  await expect(details.locator('.lesson-reading-paragraph').first()).toBeHidden();
  await details.locator('summary').click();
  await expect(details.locator('.lesson-reading-paragraph').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
