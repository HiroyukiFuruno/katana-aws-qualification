import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';

const conditions = [
  { colorScheme: 'light', width: 320 },
  { colorScheme: 'dark', width: 320 },
  { colorScheme: 'light', width: 390 },
  { colorScheme: 'dark', width: 390 },
] as const;

for (const condition of conditions) {
  test(`privacy stays within ${condition.width}px in ${condition.colorScheme} mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: condition.width });
    await page.emulateMedia({ colorScheme: condition.colorScheme });
    for (const locale of locales) {
      await page.goto(localePath(locale, 'privacy'));
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('#account-deletion')).toBeVisible();
      await expect(page.locator('#account-deletion + p')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        condition.width,
      );
    }
  });
}
