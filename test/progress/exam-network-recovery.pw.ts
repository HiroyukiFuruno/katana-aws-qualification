import { expect, type Page, test } from '@playwright/test';
import { examSessions, failNextExamSave, holdNextExamStart, releaseExamStart } from './api';
import { openExam, openMemberCourse } from './course';
import { createSessions, setRealSession } from './sessions';

function examSave(response: import('@playwright/test').Response) {
  return response.url().includes('/rpc/save_exam_response_confirmed');
}

async function startShortExam(page: Page) {
  await openExam(page);
  await page.locator('.exam-format-picker select').selectOption('short');
  await page.getByRole('button', { name: '模擬試験を開始' }).click();
  await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
}

test('a committed save with a lost response is recovered by the next mutation', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await startShortExam(page);
    await failNextExamSave();
    const failed = page.waitForResponse((response) => examSave(response) && response.status() === 503);
    await page.locator('input[name="exam-answer"]').first().click();
    expect((await failed).status()).toBe(503);
    await expect(page.getByRole('button', { exact: true, name: '見直しマーク' })).toBeEnabled();
    await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(page.getByRole('alert')).toHaveCount(0);

    const flagSaved = page.waitForResponse((response) => examSave(response) && response.ok());
    await page.getByRole('button', { exact: true, name: '見直しマーク' }).click();
    await flagSaved;
    const navigationSaved = page.waitForResponse((response) => examSave(response) && response.ok());
    await page.getByRole('button', { name: '次の問題' }).click();
    await navigationSaved;
    await expect(page.getByRole('heading', { name: /第2問/ })).toBeVisible();
    await page.reload();
    await setRealSession(page, session);
    await page.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
    await expect(page.getByRole('heading', { name: /第2問/ })).toBeVisible();
    const previousSaved = page.waitForResponse((response) => examSave(response) && response.ok());
    await page.getByRole('button', { name: '前の問題' }).click();
    await previousSaved;
    await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(page.getByRole('button', { exact: true, name: '見直しマーク' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  } finally {
    await context.close();
  }
});

test('a held exam start disables duplicate operations and resumes the single draft', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await holdNextExamStart();
    const started = page.waitForResponse(
      (response) => response.url().includes('/rpc/start_exam_session') && response.ok(),
    );
    const start = page.getByRole('button', { name: '模擬試験を開始' });
    await start.dblclick();
    await expect(start).toBeDisabled();
    await expect(page.locator('.exam-format-picker select')).toBeDisabled();
    await expect.poll(() => examSessions(session)).toHaveLength(1);
    const [beforeRelease] = await examSessions(session);
    if (!beforeRelease) throw new Error('The held start did not create a draft.');
    await releaseExamStart();
    await started;
    await expect.poll(() => examSessions(session)).toEqual([beforeRelease]);
    await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await page.reload();
    await setRealSession(page, session);
    await page.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
    await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await expect.poll(() => examSessions(session)).toEqual([beforeRelease]);
  } finally {
    await context.close();
  }
});
