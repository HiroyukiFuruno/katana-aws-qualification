import { expect, test } from '@playwright/test';
import { learningEvents } from './api';
import { openMemberCourse, startStudy } from './course';
import { createSessions } from './sessions';

test('an offline answer retries its original event UUID exactly once', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  const eventIds: string[] = [];
  try {
    const page = await context.newPage();
    page.on('request', (request) => {
      if (!request.url().includes('/rpc/append_learning_event')) return;
      const event = (request.postDataJSON() as { p_event?: { event_id?: string } }).p_event;
      if (event?.event_id) eventIds.push(event.event_id);
    });
    await openMemberCourse(page, session);
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
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole('button', { name: '再試行' })).toBeVisible();
    await page.getByRole('button', { name: '再試行' }).click();
    await expect.poll(() => learningEvents(session)).toHaveLength(1);
    await expect(page.getByRole('button', { name: '再試行' })).toHaveCount(0);
    expect(eventIds).toHaveLength(1);
    expect((await learningEvents(session))[0]?.event_id).toBe(eventIds[0]);
  } finally {
    await context.close();
  }
});
