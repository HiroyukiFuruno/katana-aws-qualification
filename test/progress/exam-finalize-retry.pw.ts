import { expect, test } from '@playwright/test';
import { examSessions, learningEvents } from './api';
import { answerCurrentQuestion, openExam, openMemberCourse, startStudy } from './course';
import { createSessions } from './sessions';
import { gatewayOrigin } from './settings';

test('a failed finalize request retries the saved draft payload exactly once', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  const finalizations: object[] = [];
  try {
    const page = await context.newPage();
    page.on('request', (request) => {
      if (!request.url().includes('/rpc/finalize_exam_session')) return;
      finalizations.push(request.postDataJSON());
    });
    await openMemberCourse(page, session);
    await page
      .getByRole('region', { name: 'Cookie設定' })
      .getByRole('button', { name: '必要なもののみ' })
      .click();
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    const answerSaved = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.locator('input[name="exam-answer"]').first().click();
    await answerSaved;
    const fault = await fetch(`${gatewayOrigin}/test/fail-next-finalize?mode=before`, {
      method: 'POST',
    });
    if (!fault.ok) throw new Error('Could not arm the finalize connection failure.');
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect.poll(() => finalizations.length).toBe(1);
    await expect(
      page.getByText('採点結果を保存できませんでした。保存領域を確認して、採点を再試行してください。'),
    ).toBeVisible();
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect
      .poll(() => examSessions(session))
      .toEqual([expect.objectContaining({ state: 'submitted' })]);
    expect(finalizations).toHaveLength(2);
    expect(finalizations[1]).toEqual(finalizations[0]);
    await expect.poll(() => learningEvents(session)).toHaveLength(15);
    await page.locator('.course-nav').getByRole('button', { name: '学ぶ' }).click();
    await startStudy(page);
    await answerCurrentQuestion(page);
    await expect(page.locator('.metrics')).toContainText('16');
  } finally {
    await context.close();
  }
});

test('a lost finalize response retries the committed payload exactly once', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  const finalizations: object[] = [];
  try {
    const page = await context.newPage();
    page.on('request', (request) => {
      if (request.url().includes('/rpc/finalize_exam_session'))
        finalizations.push(request.postDataJSON());
    });
    await openMemberCourse(page, session);
    await page
      .getByRole('region', { name: 'Cookie設定' })
      .getByRole('button', { name: '必要なもののみ' })
      .click();
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    const answerSaved = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.locator('input[name="exam-answer"]').first().click();
    await answerSaved;
    const fault = await fetch(`${gatewayOrigin}/test/fail-next-finalize?mode=after`, { method: 'POST' });
    if (!fault.ok) throw new Error('Could not arm the finalize response loss.');
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect.poll(() => finalizations.length).toBe(1);
    await expect(
      page.getByText('採点結果を保存できませんでした。保存領域を確認して、採点を再試行してください。'),
    ).toBeVisible();
    await expect
      .poll(() => examSessions(session))
      .toEqual([expect.objectContaining({ state: 'submitted' })]);
    await expect.poll(() => learningEvents(session)).toHaveLength(15);
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect.poll(() => finalizations.length).toBe(2);
    expect(finalizations[1]).toEqual(finalizations[0]);
    await expect.poll(() => learningEvents(session)).toHaveLength(15);
    await page.locator('.course-nav').getByRole('button', { name: '学ぶ' }).click();
    await startStudy(page);
    await answerCurrentQuestion(page);
    await expect(page.locator('.metrics')).toContainText('16');
  } finally {
    await context.close();
  }
});
