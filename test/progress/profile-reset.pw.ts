import { expect, test } from '@playwright/test';
import { learningEvents, profileRows } from './api';
import { answerCurrentQuestion, openMemberCourse, startStudy } from './course';
import { createSessions, setRealSession } from './sessions';

test('a cloud roadmap profile and attempts are removed together by reset', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/assessment/');
    await setRealSession(page, session);
    await page.reload();
    await page.getByRole('button', { name: '必要なもののみ' }).click();
    const certification = page.locator('.earned-directory input[type="checkbox"]').first();
    if (!(await certification.isChecked())) {
      await certification.click();
      await expect.poll(() => certification.isChecked()).toBe(true);
    }
    await expect.poll(() => profileRows(session).then((rows) => rows.length)).toBe(1);

    await openMemberCourse(page, session);
    await startStudy(page);
    await answerCurrentQuestion(page);
    await expect.poll(() => learningEvents(session).then((rows) => rows.length)).toBe(1);
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '学習データをリセット' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
    await expect.poll(() => learningEvents(session)).toEqual([]);
    await expect.poll(() => profileRows(session)).toEqual([]);
  } finally {
    await context.close();
  }
});
