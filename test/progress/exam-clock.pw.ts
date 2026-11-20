import { expect, test } from '@playwright/test';
import { examSessions, expireBeforeSave, expireExam, learningEvents } from './api';
import { openExam, openMemberCourse } from './course';
import { createSessions, setRealSession } from './sessions';

test('a member save uses server time when the browser Date clock changes by five minutes', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    await page.clock.setFixedTime(Date.now() - 5 * 60_000);
    let saved = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.locator('input[name="exam-answer"]').first().click();
    await saved;
    await page.clock.setFixedTime(Date.now() + 5 * 60_000);
    saved = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.getByRole('button', { exact: true, name: '見直しマーク' }).click();
    await saved;
  } finally {
    await context.close();
  }
});

test('a past server deadline auto-submits the confirmed draft without another save', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    const saved = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.locator('input[name="exam-answer"]').first().click();
    await saved;
    const [exam] = await examSessions(session);
    if (!exam) throw new Error('Exam session was not created.');
    await expireExam(exam.exam_id);
    let savesAfterExpiry = 0;
    page.on('request', (request) => {
      if (request.url().includes('/rpc/save_exam_response_confirmed')) savesAfterExpiry++;
    });
    await page.reload();
    await setRealSession(page, session);
    await openExam(page);
    await expect
      .poll(() => examSessions(session))
      .toEqual([expect.objectContaining({ state: 'submitted' })]);
    expect(savesAfterExpiry).toBe(0);
    await expect.poll(() => learningEvents(session)).toHaveLength(15);
  } finally {
    await context.close();
  }
});

test('a final save that crosses the deadline submits the confirmed draft', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    const initialSave = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.locator('input[name="exam-answer"]').first().click();
    await initialSave;
    const [exam] = await examSessions(session);
    if (!exam) throw new Error('Exam session was not created.');
    await expireBeforeSave(exam.exam_id);
    const rejectedSave = page.waitForResponse(
      (response) =>
        response.url().includes('/rpc/save_exam_response_confirmed') && response.status() === 400,
    );
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await rejectedSave;
    await expect
      .poll(() => examSessions(session))
      .toEqual([expect.objectContaining({ state: 'submitted' })]);
    await expect.poll(() => learningEvents(session)).toHaveLength(15);
  } finally {
    await context.close();
  }
});
