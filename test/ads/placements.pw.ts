import { expect, test } from '@playwright/test';

for (const path of ['dashboard', 'account/settings', 'assessment']) {
  for (const [width, placement, count] of [
    [390, 'inline', 1],
    [1000, 'bottom', 1],
    [1600, 'left, .site-ad--right', 2],
  ] as const) {
    test(`${path}: ${width}px advertisement follows consent`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/ja/${path}/`);
      await expect(page.locator('.site-ad')).toHaveCount(0);
      await page.getByRole('button', { name: 'アクセス解析・広告を許可', exact: true }).click();
      const ads = page.locator(`.site-ad--${placement}`);
      await expect(ads).toHaveCount(count);
      {
        const inline = page.locator('.site-ad--inline');
        await expect(inline).toHaveCount(1);
        await expect(page.locator('main h1')).toHaveCount(1);
        expect(
          await inline.evaluate((ad) => {
            const heading = document.querySelector('main h1');
            return (
              !!heading &&
              Boolean(heading.compareDocumentPosition(ad) & Node.DOCUMENT_POSITION_FOLLOWING)
            );
          }),
        ).toBe(true);
      }
      await ads.first().getByRole('button', { name: '広告を閉じる' }).click();
      await expect(ads).toHaveCount(count - 1);
    });
  }
}
