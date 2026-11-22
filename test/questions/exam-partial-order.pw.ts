import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import type { Question } from '../../src/questions';

test('a partial saved exam choice order retains every option and explanation after submission', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const [question] = JSON.parse(
    readFileSync('public/translations/en/courses/sap-c03/archive-2026-11-21.json', 'utf8'),
  ) as Question[];
  const key = JSON.stringify([question.id, question.revision]);
  await page.goto('/study/sap-c03/');
  await page.getByRole('button', { name: messages.en.cookieNecessary, exact: true }).click();
  await page.getByLabel(messages.en.progressStorageAllow, { exact: true }).check();
  await page.evaluate(
    ({ key, correct }) => {
      localStorage.setItem(
        'katana.certification-exam.v1.sap-c02',
        JSON.stringify({
          id: crypto.randomUUID(),
          deadline: Date.now() + 3_600_000,
          order: [key],
          position: 0,
          choiceOrders: { [key]: ['A'] },
          responses: { [key]: { selected: correct, flagged: false, durationMs: 1200 } },
        }),
      );
    },
    { key, correct: question.correct },
  );
  await page.reload();
  await page.getByRole('button', { name: messages.en.exam, exact: true }).click();
  await expect(page.locator('.prompt')).toHaveText(question.prompt);
  const inputs = page.locator('input[name="exam-answer"]');
  await expect(inputs).toHaveCount(question.choices.length);
  await expect(page.locator('.choice > span[lang]')).toHaveText(
    question.choices.map(({ text }) => text),
  );
  for (const id of question.correct)
    await expect(inputs.nth(question.choices.findIndex((choice) => choice.id === id))).toBeChecked();
  await page.getByRole('button', { name: messages.en.submitExam, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: messages.en.submit, exact: true }).click();
  await page.getByLabel(messages.en.includeCorrect).check();
  const review = page.locator('.exam-solutions details');
  await review.locator('summary').click();
  await expect(review.locator('li')).toHaveCount(question.choices.length);
  for (const [index, choice] of question.choices.entries()) {
    await expect(review.locator('li').nth(index)).toContainText(choice.text);
    await expect(review.locator('li').nth(index)).toContainText(choice.explanation);
  }
  const history = await page.evaluate(() => localStorage.getItem('saa-study.attempts.v1'));
  if (!history) throw new Error('Exam history was not saved');
  expect(JSON.parse(history)).toEqual([
    expect.objectContaining({ questionId: question.id, correct: question.correct, isCorrect: true }),
  ]);
  expect(errors).toEqual([]);
});
