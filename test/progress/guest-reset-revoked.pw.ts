import { expect, test } from '@playwright/test';
import { keys, seedLegacyRecords } from './guest-reset.helpers';

const consentKey = 'katana.learning-progress-consent.v1';
const sentinelKey = 'qa.guest-reset-sentinel.v1';

test('guest reset after consent withdrawal clears legacy records permanently', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await context.addCookies([
      { name: 'saa_study_incorrect_v1', value: 'mock-secure-01', url: 'http://127.0.0.1:5273/' },
    ]);
    await page.goto('/ja/study/saa-c03/');
    await seedLegacyRecords(page);
    await page.evaluate((key) => localStorage.setItem(key, 'keep'), sentinelKey);
    await page.reload();
    await expect(page.locator('.metrics')).toContainText('1');
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').uncheck();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), consentKey)).toBeNull();
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '学習データをリセット' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
    await expect(page.getByText('学習データをリセットしました。')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate((legacyKeys) => legacyKeys.map((key) => localStorage.getItem(key)), keys),
      )
      .toEqual([null, null, null, null, null]);
    await expect
      .poll(() => page.evaluate(() => document.cookie))
      .not.toContain('saa_study_incorrect_v1=');
    await expect(page.evaluate((key) => localStorage.getItem(key), sentinelKey)).resolves.toBe('keep');
    await page.locator('.course-nav').getByRole('button', { name: '学ぶ' }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), consentKey))
      .toBe('granted');
    await page.reload();
    await expect(page.locator('.metrics')).toContainText('0');
    await expect
      .poll(() =>
        page.evaluate((legacyKeys) => legacyKeys.map((key) => localStorage.getItem(key)), keys),
      )
      .toEqual([null, null, null, null, null]);
    await expect(page.evaluate((key) => localStorage.getItem(key), sentinelKey)).resolves.toBe('keep');
  } finally {
    await context.close();
  }
});
