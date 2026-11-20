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
