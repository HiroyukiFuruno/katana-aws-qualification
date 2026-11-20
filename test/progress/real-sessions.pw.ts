import { expect, test } from '@playwright/test';
import { activeUserId, createSessions, setRealSession } from './sessions';

test('GoTrue-issued sessions are installed through the real SDK and remain context-isolated', async ({
  browser,
}) => {
  const [first, second] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();
    await Promise.all([firstPage.goto('/ja/'), secondPage.goto('/ja/')]);
    await Promise.all([setRealSession(firstPage, first), setRealSession(secondPage, second)]);
    await expect.poll(() => activeUserId(firstPage)).toBe(first.userId);
    await expect.poll(() => activeUserId(secondPage)).toBe(second.userId);
    expect(first.userId).not.toBe(second.userId);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
