import { expect, test } from '@playwright/test';
import { holdNextExamSave, releaseExamSave } from './api';
import { openExam, openMemberCourse } from './course';
import { createSessions, setRealSession } from './sessions';

function examSave(response: import('@playwright/test').Response) {
  return response.url().includes('/rpc/save_exam_response_confirmed');
}

async function moveToMultipleChoice(page: import('@playwright/test').Page) {
  const next = page.getByRole('button', { name: '次の問題' });
  for (let position = 1; position < 65; position += 1) {
    const meta = (await page.locator('.question-meta').textContent()) ?? '';
    if (Number(meta.match(/(\d+)つ選択/)?.[1] ?? '0') >= 2 && (await next.isEnabled())) return;
    const saved = page.waitForResponse((response) => examSave(response) && response.ok());
    await next.click();
    await saved;
  }
  throw new Error('The full exam did not contain a multi-choice question before its last item.');
}

test('a delayed real exam save blocks mutations until its acknowledged revision is visible', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await openExam(page);
    await page.locator('.exam-format-picker select').selectOption('full');
    await page.getByRole('button', { name: '模擬試験を開始' }).click();
    await moveToMultipleChoice(page);
    await holdNextExamSave();
    const firstRequest = page.waitForRequest((request) =>
      request.url().includes('/rpc/save_exam_response_confirmed'),
    );
    const firstResponse = page.waitForResponse(examSave);
    const choices = page.locator('input[name="exam-answer"]');
    await choices.first().click();
    await firstRequest;
    await expect(page.locator('.exam-question-title').locator('..')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await expect(page.getByRole('button', { name: '見直しマーク' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '次の問題' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '試験を提出する' })).toBeDisabled();
    await releaseExamSave();
    expect((await firstResponse).ok()).toBe(true);
    await expect(choices.first()).toBeChecked();
    const secondResponse = page.waitForResponse((response) => examSave(response) && response.ok());
    await choices.nth(1).click();
    await secondResponse;
    await expect(choices.first()).toBeChecked();
    await expect(choices.nth(1)).toBeChecked();
    const selectedHeading = await page.locator('.exam-question-title').textContent();
    const navigationResponse = page.waitForResponse((response) => examSave(response) && response.ok());
    await page.getByRole('button', { name: '次の問題' }).click();
    await navigationResponse;
    await expect(page.locator('.exam-question-title')).not.toHaveText(selectedHeading ?? '');
    await page.reload();
    await setRealSession(page, session);
    await page.locator('.course-nav').getByRole('button', { name: '模擬試験' }).click();
    const previousResponse = page.waitForResponse((response) => examSave(response) && response.ok());
    await page.getByRole('button', { name: '前の問題' }).click();
    await previousResponse;
    await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
    await expect(page.locator('input[name="exam-answer"]').nth(1)).toBeChecked();
  } finally {
    await context.close();
  }
});
