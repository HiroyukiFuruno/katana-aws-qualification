import { expect, test } from '@playwright/test';
import { learningEvents } from './api';
import { openMemberCourse, startStudy } from './course';
import { activeUserId, createSessions, setRealSession } from './sessions';

// 切替前後の実SDK・RESTで元ownerのeventIDを照合し、別ownerへの再束縛を検知する。
test('an offline answer stays with its original owner across A to B to A', async ({ browser }) => {
  const [first, second] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, first);
    await startStudy(page);
    const grade = page.getByRole('button', { name: '採点する' });
    const choices = page.locator('input[name="answer"]');
    for (let index = 0; index < (await choices.count()); index++) {
      if (await grade.isEnabled()) break;
      await choices.nth(index).check();
    }
    await context.setOffline(true);
    await grade.click();
    await expect(
      page.getByText('学習履歴を保存できませんでした。保存領域の設定を確認してから再試行してください。'),
    ).toBeVisible();
    const key = `katana.learning-outbox.v1.${first.userId}`;
    const raw = await page.evaluate((key) => localStorage.getItem(key), key);
    if (!raw) throw new Error('Missing actual offline pending answer');
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== 'object' || !('events' in stored) || !Array.isArray(stored.events))
      throw new Error('Invalid actual pending answer');
    const event: unknown = stored.events[0];
    if (
      !event ||
      typeof event !== 'object' ||
      !('eventId' in event) ||
      typeof event.eventId !== 'string'
    )
      throw new Error('Missing original event UUID');
    await context.setOffline(false);
    await setRealSession(page, second);
    await expect.poll(() => activeUserId(page)).toBe(second.userId);
    await expect(page.getByRole('button', { name: '再試行', exact: true })).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
    expect(await learningEvents(second)).toEqual([]);
    expect(await learningEvents(first)).toEqual([]);
    await setRealSession(page, first);
    await expect.poll(() => activeUserId(page)).toBe(first.userId);
    await expect(page.getByRole('button', { name: '再試行', exact: true })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
    await page.getByRole('button', { name: '再試行', exact: true }).click();
    await expect
      .poll(() => learningEvents(first).then((rows) => rows.map((row) => row.event_id)))
      .toEqual([event.eventId]);
    expect(await learningEvents(second)).toEqual([]);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  } finally {
    await context.setOffline(false);
    await context.close();
  }
});
