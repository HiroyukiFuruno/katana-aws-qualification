import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';

test('a saved SAA exam resumes Cognito revision 1 with its original clarification and grading', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const [question] = JSON.parse(readFileSync('public/courses/saa-c03/archive-2026-11-21.json', 'utf8'));
  const key = JSON.stringify([question.id, question.revision]);
  await page.goto('/ja/study/saa-c03/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.getByLabel('ゲストの学習記録をこの端末に保存する', { exact: true }).check();
  await page.evaluate((questionKey) => {
    localStorage.setItem(
      'saa-study.exam.v1',
      JSON.stringify({
        id: crypto.randomUUID(),
        deadline: Date.now() + 3_600_000,
        order: [questionKey],
        position: 0,
        responses: { [questionKey]: { selected: ['A'], flagged: false, durationMs: 1_200 } },
      }),
    );
  }, key);
  await page.reload();
  await page.getByRole('button', { name: '模擬試験', exact: true }).click();
  await expect(page.locator('.prompt')).toHaveText(question.prompt);
  await expect(page.locator('.question-clarification')).toHaveText(
    messages.ja.archivedCognitoAdaptiveMfaClarification,
  );
  await expect(page.locator('input[name="exam-answer"]').first()).toBeChecked();
  await page.getByRole('button', { name: '試験を提出する' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '提出する', exact: true }).click();
  await expect(page.locator('.exam-score')).toHaveText('1問中 1問正解');
  const history = await page.evaluate(() => localStorage.getItem('saa-study.attempts.v1'));
  if (history === null) throw new Error('Saved exam history is missing');
  expect(JSON.parse(history)).toEqual([
    expect.objectContaining({
      questionId: question.id,
      questionRevision: 1,
      correct: ['A'],
      isCorrect: true,
    }),
  ]);
  expect(errors).toEqual([]);
});
