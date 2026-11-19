import { expect, test } from '@playwright/test';
import { localePath } from '../../src/locales';

for (const width of [320, 390, 768, 1280]) {
  test(`header separates identity and controls from fixed-width navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ['ja', 'en', 'de'] as const) {
      await page.goto(localePath(locale));
      const geometry = await page.locator('.topbar').evaluate((header) => {
        const box = (selector: string) => {
          const element = header.querySelector(selector);
          if (!element) throw new Error(selector);
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          brand: box('.brand'),
          controls: box('.account-controls'),
          nav: box('.site-navigation'),
          menu: [
            ...header.querySelectorAll('.site-navigation > a, .site-navigation > .study-navigation'),
          ].map((item) => item.getBoundingClientRect().width),
        };
      });
      expect(geometry.nav.y).toBeGreaterThanOrEqual(
        Math.max(
          geometry.brand.y + geometry.brand.height,
          geometry.controls.y + geometry.controls.height,
        ),
      );
      expect(geometry.brand.x + geometry.brand.width).toBeLessThanOrEqual(geometry.controls.x);
      for (const itemWidth of geometry.menu) expect(itemWidth).toBeCloseTo(geometry.nav.width / 4, 0);
      await expect(page.locator('#site-locale')).toBeVisible();
      await expect(page.locator('.account-avatar-button')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}
