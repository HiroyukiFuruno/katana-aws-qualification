import { expect, test } from '@playwright/test';
import { answerCurrentQuestion, startStudy } from './course';

const progressConsent = 'katana.learning-progress-consent.v1';
const analyticsConsent = 'katana-aws:analytics-consent';
const cookieConsent = 'katana-aws:cookie-consent';
const historyKey = 'saa-study.attempts.v1';

test('guest progress permission persists only learning data and does not grant analytics consent', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    const permission = page.getByLabel('ゲストの学習記録をこの端末に保存する');
    await permission.check();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), progressConsent))
      .toBe('granted');
    expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsent)).toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), cookieConsent)).toBeNull();
    expect(await page.locator('#katana-analytics').count()).toBe(0);
    await startStudy(page);
    await answerCurrentQuestion(page);
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), historyKey))
      .not.toBeNull();
    await page.reload();
    await expect(page.locator('.metrics')).toContainText('1');
  } finally {
    await context.close();
  }
});
