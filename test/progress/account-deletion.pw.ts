import { expect, test } from '@playwright/test';
import { learningEvents } from './api';
import { answerCurrentQuestion, openMemberCourse, startStudy } from './course';
import { createSessions, setRealSession } from './sessions';

test('account deletion invokes the real handler and cascades learning records', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await startStudy(page);
    await answerCurrentQuestion(page);
    await expect.poll(() => learningEvents(session).then((rows) => rows.length)).toBe(1);
    await page.goto('/ja/dashboard/');
    await setRealSession(page, session);
    await page.reload();
    await page.getByRole('button', { name: 'アカウントを削除' }).click();
    await page.getByRole('button', { name: 'アカウントを完全に削除' }).click();
    await expect(page).toHaveURL(/\/ja\/$/);
  } finally {
    await context.close();
  }
});
