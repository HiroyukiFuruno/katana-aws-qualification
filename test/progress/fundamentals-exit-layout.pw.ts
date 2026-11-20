import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';
import { lessonAssets } from './fundamentals.helpers';
import { appOrigin } from './settings';

const asset = lessonAssets[0];
if (!asset) throw new Error('Missing first lesson fixture.');
for (const locale of locales) {
  test(`lesson exit remains visible and keyboard accessible in ${locale}`, async ({ page }) => {
    await page.goto('/ja/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    for (const width of [320, 390]) {
      for (const theme of ['light', 'dark']) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
        await page.evaluate((theme) => localStorage.setItem('katana-site-theme', theme), theme);
        await page.goto(lessonPath({ locale, unitId: asset.unit.id, stage: 'resume' }));
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const exit = page.getByRole('button', { name: messages[locale].lessonExit, exact: true });
        await expect(exit).toBeEnabled();
        const bounds = await exit.boundingBox();
        expect(bounds).not.toBeNull();
        if (!bounds) throw new Error('Exit button has no geometry.');
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const navigation = await page.locator('.lesson-slide-actions').evaluate((footer) => {
          const previous = footer.querySelector('.lesson-slide-action')?.getBoundingClientRect();
          const next = footer.querySelector('button.primary')?.getBoundingClientRect();
          if (!previous || !next) throw new Error('Missing navigation controls.');
          return {
            widthDifference: Math.abs(previous.width - next.width),
            heightDifference: Math.abs(previous.height - next.height),
            bottom: footer.getBoundingClientRect().bottom,
            viewport: visualViewport?.height ?? innerHeight,
          };
        });
        expect(navigation.widthDifference).toBeLessThanOrEqual(1);
        expect(navigation.heightDifference).toBeLessThanOrEqual(1);
        expect(navigation.bottom).toBeLessThanOrEqual(navigation.viewport);
        await exit.focus();
        await expect(exit).toBeFocused();
        if (locale === 'ja' && width === 390 && theme === 'dark')
          await page.screenshot({ path: 'test-results/progress/issue67-exit-390-dark.png' });
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(`${appOrigin}${localePath(locale, 'study/fundamentals')}`);
      }
    }
  });
}
