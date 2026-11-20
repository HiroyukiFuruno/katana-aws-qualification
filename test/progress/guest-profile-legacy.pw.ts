import { expect, test } from '@playwright/test';

const profileKey = 'katana.certification-profile.v1';

async function expectReplacedQualifications(page: import('@playwright/test').Page) {
  for (const id of ['DVA-C03', 'SAP-C03']) {
    const checkbox = page.locator('.earned-directory label').filter({ hasText: id }).locator('input');
    await expect(checkbox).toBeChecked();
  }
}

test('consented guest profile normalizes legacy certification ids across reload', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/assessment/');
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: profileKey,
      value: { earned: ['dva-c02', 'sap-c02'], answers: {} },
    });
    await page.reload();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), profileKey))
      .toContain('dva-c02');
    await expectReplacedQualifications(page);
    await page.reload();
    await expectReplacedQualifications(page);
  } finally {
    await context.close();
  }
});
