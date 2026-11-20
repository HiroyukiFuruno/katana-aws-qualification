import { expect, test } from '@playwright/test';
import { learningEvents } from './api';
import { answerCurrentQuestion, openMemberCourse, startStudy } from './course';
import { createSessions, setRealSession } from './sessions';

test('a member answer survives reload, is visible in another same-user context, and is hidden from B', async ({
  browser,
}) => {
  const [first, second] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const sameUserContext = await browser.newContext();
  try {
    const firstPage = await firstContext.newPage();
    await openMemberCourse(firstPage, first);
    await startStudy(firstPage);
    await answerCurrentQuestion(firstPage);
    await expect.poll(() => learningEvents(first).then((events) => events.length)).toBe(1);
    await firstPage.reload();
    await expect(firstPage.locator('.metrics')).toContainText('1');

    const sameUserPage = await sameUserContext.newPage();
    await sameUserPage.goto('/ja/study/saa-c03/');
    await setRealSession(sameUserPage, first);
    await sameUserPage.reload();
    await expect.poll(() => learningEvents(first).then((events) => events.length)).toBe(1);

    const secondPage = await secondContext.newPage();
    await openMemberCourse(secondPage, second);
    await expect.poll(() => learningEvents(second)).toEqual([]);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close(), sameUserContext.close()]);
  }
});
