import { expect, type Page, test } from '@playwright/test';
import { examSessions } from './api';
import { openExam, openMemberCourse } from './course';
import { createSessions, setRealSession } from './sessions';
import { gatewayOrigin } from './settings';

async function control(name: string) {
  const response = await fetch(`${gatewayOrigin}/test/${name}`, { method: 'POST' });
  expect(response.status).toBe(204);
}

function saved(response: import('@playwright/test').Response) {
  return response.url().includes('/rpc/save_exam_response_confirmed') && response.ok();
}

async function openSharedExam(page: Page, session: Awaited<ReturnType<typeof createSessions>>[number]) {
  await openMemberCourse(page, session);
  await page.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
  await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
}

test('a rejected stale edit reloads the saved answer before the member continues', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  let loadHeld = false;
  try {
    const first = await firstContext.newPage();
    await openMemberCourse(first, session);
    await openExam(first);
    await first.locator('.exam-format-picker select').selectOption('short');
    await first.getByRole('button', { name: '模擬試験を開始' }).click();
    await expect(first.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await expect.poll(() => examSessions(session)).toHaveLength(1);
    const [exam] = await examSessions(session);
    if (!exam) throw new Error('The started exam was not stored.');

    const second = await secondContext.newPage();
    await openSharedExam(second, session);
    const savedByFirst = first.waitForResponse(saved);
    await first.locator('input[name="exam-answer"]').first().click();
    await savedByFirst;

    const rejected = second.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && !response.ok(),
    );
    await second.locator('input[name="exam-answer"]').nth(1).click();
    const rejection = await rejected;
    expect(rejection.status()).toBe(412);
    await expect(rejection.json()).resolves.toMatchObject({ code: 'PT412' });
    await expect(second.getByRole('alert')).toContainText('回答を保存できませんでした。');
    const reload = second.getByRole('button', { name: '保存済みの回答を再読み込み' });
    await expect(reload).toBeEnabled();
    await control('hold-next-exam-load');
    loadHeld = true;
    const loading = second.waitForRequest((request) =>
      request.url().includes('/rest/v1/exam_sessions?'),
    );
    await reload.click();
    await loading;
    await expect(reload).toBeDisabled();
    await expect(second.locator('input[name="exam-answer"]').first()).toBeDisabled();
    await expect(second.getByRole('button', { name: '次の問題' })).toBeDisabled();
    await control('release-exam-load');
    loadHeld = false;
    await expect(second.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(second.locator('input[name="exam-answer"]').nth(1)).not.toBeChecked();

    const flagged = second.waitForResponse(saved);
    await second.getByRole('button', { name: '見直しマーク', exact: true }).click();
    await flagged;
    const next = second.waitForResponse(saved);
    await second.getByRole('button', { name: '次の問題' }).click();
    await next;
    await expect(second.getByRole('heading', { name: /第2問/ })).toBeVisible();
    await expect.poll(() => examSessions(session)).toEqual([exam]);

    await second.reload();
    await setRealSession(second, session);
    await second.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
    await expect(second.getByRole('heading', { name: /第2問/ })).toBeVisible();
  } finally {
    try {
      if (loadHeld) await control('release-exam-load');
    } finally {
      await Promise.all([firstContext.close(), secondContext.close()]);
    }
  }
});
