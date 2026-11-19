import { expect, test } from '@playwright/test';

const limits = new Map([
  ['H1', 36],
  ['H2', 26],
  ['H3', 20],
]);

for (const width of [320, 390, 1280, 1440]) {
  test(`headings stay within a restrained shared scale at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/ja/', '/ja/privacy/', '/ja/certifications/saa-c03/']) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      const sizes = await page.locator('main').evaluate((main) =>
        [...main.querySelectorAll('h1, h2, h3')].map((element) => ({
          tag: element.tagName,
          size: Number.parseFloat(getComputedStyle(element).fontSize),
        })),
      );
      for (const item of sizes)
        expect(item.size).toBeLessThanOrEqual((limits.get(item.tag) ?? 20) + 0.1);
    }
  });
}
