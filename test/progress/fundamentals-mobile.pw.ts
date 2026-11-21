import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonAssets } from './fundamentals.helpers';
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
        `STEP ${asset.totalSteps - asset.finalQuestions.length + 1}`,
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
  await expect(page).toHaveURL(/\/slides\/2\/$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
