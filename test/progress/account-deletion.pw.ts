import { expect, test } from '@playwright/test';
import { learningEvents } from './api';
import { answerCurrentQuestion, openMemberCourse, startStudy } from './course';
import { acceptNecessaryCookies } from './fundamentals-mobile.helpers';
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
    await expect(page.getByRole('heading', { name: '学習ダッシュボード' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'アカウントを削除' })).toHaveCount(0);
    await page.goto('/ja/account/settings/');
    await setRealSession(page, session);
    await page.reload();
    await acceptNecessaryCookies(page);
    await expect(page.getByRole('heading', { name: 'アカウント設定' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '学習ダッシュボード' })).toHaveCount(0);
    await page.getByRole('button', { name: 'アカウントを削除' }).click();
    await page.getByRole('button', { name: 'アカウントを完全に削除' }).click();
    await expect(page).toHaveURL(/\/ja\/$/);
  } finally {
    await context.close();
  }
});
