import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { acceptNecessaryCookies } from '../progress/fundamentals-mobile.helpers';

for (const width of [320, 390]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const locale of locales) {
      test(`fundamentals catalog ${locale} at ${width}px in ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme });
        await page.goto(localePath(locale));
        const route = localePath(locale, 'study/fundamentals');
        await page.locator('.study-navigation-toggle').click();
        const link = page.locator(`a[href="${route}"]:visible`).first();
        await expect(link).toBeVisible();
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
        await acceptNecessaryCookies(page);
        await expect(page.locator('.lesson-catalog-card a.primary').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      });
    }
  }
}
