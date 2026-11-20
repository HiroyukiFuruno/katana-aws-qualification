import { expect, test } from '@playwright/test';
import { examSessions, learningEvents, replayRpc } from './api';
import { openExam, openMemberCourse } from './course';
import { createSessions, setRealSession } from './sessions';

test('a cloud exam resumes after reload and a repeated finalization stays idempotent', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  let finalization: object | undefined;
  try {
    const page = await context.newPage();
    page.on('request', (request) => {
      if (request.url().includes('/rpc/finalize_exam_session')) finalization = request.postDataJSON();
    });
    await openMemberCourse(page, session);
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    await expect
      .poll(() => examSessions(session))
      .toEqual([expect.objectContaining({ state: 'draft' })]);
    await page.reload();
    await setRealSession(page, session);
    await openExam(page);
    await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect
      .poll(() => examSessions(session))
      .toEqual([expect.objectContaining({ state: 'submitted' })]);
    if (!finalization) throw new Error('The browser did not submit a finalize request.');
    await replayRpc('/rpc/finalize_exam_session', session.accessToken, finalization);
    const events = await learningEvents(session);
    expect(events).toHaveLength(15);
  } finally {
    await context.close();
  }
});
