import { expect, type Page, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 760 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
];

async function bounds(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing bounds for ${selector}`);
  return box;
}

test('landing cards retain hierarchy and viewport bounds in light and dark themes', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/ja/');
      const entry = await bounds(page, '.landing-content > .entry-grid');
      const benefits = await bounds(page, '.landing-content > .account-benefits');
      const faq = await bounds(page, '.landing-faq');
      expect(benefits.y - (entry.y + entry.height)).toBeGreaterThanOrEqual(24);
      expect(faq.y - (benefits.y + benefits.height)).toBeGreaterThanOrEqual(24);
      for (const selector of ['.entry-card', '.account-benefits', '.landing-faq-item']) {
        for (const box of await page.locator(selector).all()) {
          const card = await box.boundingBox();
          expect(card).not.toBeNull();
          expect(card?.x ?? -1).toBeGreaterThanOrEqual(0);
          expect((card?.x ?? 0) + (card?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
        }
      }
      for (const summary of await page.locator('.landing-faq-item summary').all()) {
        const parent = await summary.boundingBox();
        const label = await summary.locator('span').boundingBox();
        expect((label?.x ?? 0) - (parent?.x ?? 0)).toBeGreaterThanOrEqual(40);
        expect((label?.x ?? 0) + (label?.width ?? 0)).toBeLessThan(viewport.width - 30);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        viewport.width,
      );
    }
  }
});

test('FAQ toggles by keyboard, keeps focus visible and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ja/');
  const item = page.locator('.landing-faq-item').nth(1);
  const summary = item.locator('summary');
  await summary.focus();
  await expect(summary).toBeFocused();
  await expect(summary).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(item).toHaveAttribute('open', '');
  await expect(item.locator('.landing-faq-answer')).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Space');
  await expect(item).not.toHaveAttribute('open', '');
});
