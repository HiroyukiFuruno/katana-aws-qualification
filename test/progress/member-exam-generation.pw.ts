import { expect, type Page, test } from '@playwright/test';
import { examSessions, learningEvents } from './api';
import { openExam, openMemberCourse } from './course';
import { createSessions, setRealSession } from './sessions';

function saved(response: import('@playwright/test').Response) {
  return response.url().includes('/rpc/save_exam_response_confirmed') && response.ok();
}

async function openSharedExam(page: Page, session: Awaited<ReturnType<typeof createSessions>>[number]) {
  await openMemberCourse(page, session);
  await page.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
  await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
}

test('an old member exam cannot resume after another tab resets learning data', async ({ browser }) => {
  const [session] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    await openMemberCourse(first, session);
    await openExam(first);
    await first.locator('.exam-format-picker select').selectOption('short');
    await first.getByRole('button', { name: '模擬試験を開始' }).click();
    await expect(first.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await expect.poll(() => examSessions(session)).toHaveLength(1);
    const [oldExam] = await examSessions(session);
    if (!oldExam) throw new Error('The original exam was not stored.');

    const second = await secondContext.newPage();
    await openSharedExam(second, session);

    await first.getByRole('button', { name: '設定', exact: true }).click();
    await first.getByRole('button', { name: '学習データをリセット' }).click();
    await first.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
    await expect(first.getByText('学習データをリセットしました。')).toBeVisible();
    await expect.poll(() => examSessions(session)).toEqual([]);
    await expect.poll(() => learningEvents(session)).toEqual([]);

    const rejected = second.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && !response.ok(),
    );
    await second.locator('input[name="exam-answer"]').first().click();
    const rejection = await rejected;
    expect(rejection.status()).toBe(409);
    await expect(rejection.json()).resolves.toMatchObject({ code: 'PT409' });
    await expect(second.getByRole('heading', { name: '模擬試験の出題設定' })).toBeVisible();

    await second.locator('.exam-format-picker select').selectOption('short');
    const clock = second.waitForRequest((request) => request.url().includes('/rpc/read_learning_clock'));
    const started = second.waitForRequest((request) =>
      request.url().includes('/rpc/start_exam_session'),
    );
    await second.getByRole('button', { name: '模擬試験を開始' }).click();
    expect((await clock).postDataJSON()).toMatchObject({ p_expected_generation: 1 });
    expect((await started).postDataJSON()).toMatchObject({ p_expected_generation: 1 });
    await expect(second.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await expect.poll(() => examSessions(session)).toHaveLength(1);
    const [newExam] = await examSessions(session);
    expect(newExam).toBeDefined();
    expect(newExam?.exam_id).not.toBe(oldExam.exam_id);
    await expect.poll(() => learningEvents(session)).toEqual([]);

    const answered = second.waitForResponse(saved);
    await second.locator('input[name="exam-answer"]').first().click();
    await answered;
    const flagged = second.waitForResponse(saved);
    await second.getByRole('button', { name: '見直しマーク', exact: true }).click();
    await flagged;
    const moved = second.waitForResponse(saved);
    await second.getByRole('button', { name: '次の問題' }).click();
    await moved;
    await expect(second.getByRole('heading', { name: /第2問/ })).toBeVisible();

    await second.reload();
    await setRealSession(second, session);
    await second.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
    await expect(second.getByRole('heading', { name: /第2問/ })).toBeVisible();
    await expect.poll(() => examSessions(session)).toEqual([newExam]);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
