import { expect, test } from '@playwright/test';
import { answerCurrentQuestion, openMemberCourse, startStudy } from './course';
import { attempt, keys, seedLegacyRecords } from './guest-reset.helpers';
import { createSessions, setRealSession } from './sessions';

test('guest reset removes every legacy learning record and stays clear after reload', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await context.addCookies([
      { name: 'saa_study_incorrect_v1', value: 'mock-secure-01', url: 'http://127.0.0.1:5273/' },
    ]);
    await page.goto('/ja/study/saa-c03/');
    await seedLegacyRecords(page);
    await page.reload();
    await expect(page.locator('.metrics')).toContainText('1');
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '学習データをリセット' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
    await expect(page.getByText('学習データをリセットしました。')).toBeVisible();
    await expect
      .poll(() => page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), keys))
      .toEqual([null, null, null, null, null]);
    await expect
      .poll(() => page.evaluate(() => document.cookie))
      .not.toContain('saa_study_incorrect_v1=');
    await page.reload();
    await expect(page.locator('.metrics')).toContainText('0');
  } finally {
    await context.close();
  }
});

test('member reset leaves unrelated guest browser records untouched', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/saa-c03/');
    await setRealSession(page, session);
    await page.reload();
    await openMemberCourse(page, session);
    await startStudy(page);
    await answerCurrentQuestion(page);
    await context.addCookies([
      { name: 'saa_study_incorrect_v1', value: 'mock-secure-01', url: 'http://127.0.0.1:5273/' },
    ]);
    await seedLegacyRecords(page);
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '学習データをリセット' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
    await expect(page.getByText('学習データをリセットしました。')).toBeVisible();
    await expect
      .poll(() => page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), keys))
      .toEqual([
        attempt,
        JSON.stringify({ earned: ['saa-c03'], answers: {} }),
        '["mock-secure-01"]',
        JSON.stringify({ id: 'legacy', order: [], responses: {} }),
        JSON.stringify({ id: 'current', order: [], responses: {} }),
      ]);
    await expect.poll(() => page.evaluate(() => document.cookie)).toContain('saa_study_incorrect_v1=');
  } finally {
    await context.close();
  }
});
