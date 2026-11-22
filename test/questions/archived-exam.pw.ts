import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { messages } from '../../src/messages';

test('an existing exam resumes the archived question revision and retains its original grading', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const [question] = JSON.parse(readFileSync('public/courses/sap-c03/archive-2026-11-21.json', 'utf8'));
  const key = JSON.stringify([question.id, question.revision]);
  await page.goto('/ja/study/sap-c03/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.getByLabel('ゲストの学習記録をこの端末に保存する', { exact: true }).check();
  await page.evaluate((questionKey) => {
    localStorage.setItem(
      'katana.certification-exam.v1.sap-c02',
      JSON.stringify({
        id: crypto.randomUUID(),
        deadline: Date.now() + 3_600_000,
        order: [questionKey],
        position: 0,
        responses: { [questionKey]: { selected: ['C'], flagged: false, durationMs: 1_200 } },
      }),
    );
  }, key);
  await page.reload();
  await page.getByRole('button', { name: '模擬試験', exact: true }).click();
  await expect(page.locator('.prompt')).toHaveText(question.prompt);
  await expect(page.locator('.question-clarification')).toHaveText(
    messages.ja.archivedFirewallScopeClarification,
  );
  await expect(page.locator('input[name="exam-answer"]').nth(2)).toBeChecked();
  await page.getByRole('button', { name: '試験を提出する' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '提出する', exact: true }).click();
  await expect(page.locator('.exam-score')).toHaveText('1問中 1問正解');
  await page.getByLabel(messages.ja.includeCorrect).check();
  const review = page.locator('.exam-solutions details');
  await review.locator('summary').click();
  await expect(review.locator('.question-clarification')).toHaveText(
    messages.ja.archivedFirewallScopeClarification,
  );
  await expect(
    review.getByRole('link', { name: 'AWS Firewall Manager 開発者ガイド ↗', exact: true }),
  ).toHaveAttribute(
    'href',
    'https://docs.aws.amazon.com/waf/latest/developerguide/network-firewall-policies.html',
  );
  const history = await page.evaluate(() => localStorage.getItem('saa-study.attempts.v1'));
  if (history === null) throw new Error('Saved exam history is missing');
  const attempts = JSON.parse(history);
  expect(attempts).toEqual([
    expect.objectContaining({
      questionId: question.id,
      questionRevision: 1,
      correct: ['C'],
      isCorrect: true,
    }),
  ]);
  expect(errors).toEqual([]);
});
