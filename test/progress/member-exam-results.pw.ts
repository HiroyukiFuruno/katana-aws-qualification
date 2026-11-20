import { expect, test } from '@playwright/test';
import { examSessions, learningEvents } from './api';
import { openExam, openMemberCourse } from './course';
import { createSessions } from './sessions';

test('submitted member exam results remain accessible after switching tabs and reloading', async ({
  browser,
}) => {
  const [session, other] = await createSessions();
  const context = await browser.newContext();
  const otherContext = await browser.newContext();
  let starts = 0;
  try {
    const page = await context.newPage();
    page.on('request', (request) => {
      if (request.url().includes('/rpc/start_exam_session')) starts++;
    });
    await openMemberCourse(page, session);
    await page
      .getByRole('region', { name: 'Cookie設定' })
      .getByRole('button', { name: '必要なもののみ' })
      .click();
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    const saved = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.locator('input[name="exam-answer"]').first().click();
    await saved;
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する' }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
    await expect.poll(() => learningEvents(session)).toHaveLength(15);
    const original = await examSessions(session);
    expect(original).toEqual([expect.objectContaining({ state: 'submitted' })]);

    await page.locator('.course-nav').getByRole('button', { name: '学ぶ', exact: true }).click();
    await openExam(page);
    await page.getByRole('button', { name: '結果を見る', exact: true }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
    await page.getByLabel('正解した問題も表示').check();
    await expect(page.locator('.exam-solutions > details')).toHaveCount(15);
    const summary = await page.locator('.exam-solutions > details > summary').first().textContent();
    if (!summary) throw new Error('The saved exam explanation summary is missing.');
    await page.locator('.exam-solutions > details > summary').first().click();
    await expect(page.locator('.exam-solutions > details').first().locator('li').first()).toBeVisible();
    expect(starts).toBe(1);
    expect(await examSessions(session)).toEqual(original);

    await page.reload();
    await openExam(page);
    await page.getByRole('button', { name: '結果を見る', exact: true }).click();
    await expect(page.getByRole('heading', { name: '模擬試験の結果' })).toBeVisible();
    await page.getByLabel('正解した問題も表示').check();
    await expect(page.locator('.exam-solutions > details')).toHaveCount(15);
    await expect(page.locator('.exam-solutions > details > summary').first()).toHaveText(summary);
    expect(starts).toBe(1);
    expect(await examSessions(session)).toEqual(original);
    expect(await learningEvents(session)).toHaveLength(15);

    await page.locator('.exam-format-picker select').selectOption('short');
    await page.getByRole('button', { name: '次の模擬試験を開始' }).click();
    await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
    const newSave = page.waitForResponse(
      (response) => response.url().includes('/rpc/save_exam_response_confirmed') && response.ok(),
    );
    await page.locator('input[name="exam-answer"]').first().click();
    await newSave;
    const sessions = await examSessions(session);
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((item) => item.state === 'draft')).toHaveLength(1);
    await page.reload();
    await page.locator('.course-nav').getByRole('button', { name: '模擬試験', exact: true }).click();
    await expect(page.getByRole('heading', { name: /第1問/ })).toBeVisible();
    await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
    expect(await examSessions(session)).toEqual(sessions);
    expect(starts).toBe(2);
    expect(await learningEvents(session)).toHaveLength(15);

    const otherPage = await otherContext.newPage();
    await openMemberCourse(otherPage, other);
    await openExam(otherPage);
    await expect(otherPage.getByRole('button', { name: '結果を見る', exact: true })).toHaveCount(0);
    expect(await examSessions(other)).toEqual([]);
  } finally {
    await Promise.all([context.close(), otherContext.close()]);
  }
});
