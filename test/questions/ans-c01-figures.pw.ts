import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import { parseQuestions, questionKey } from '../../src/questions';

const bank = parseQuestions(
  JSON.parse(readFileSync('public/courses/ans-c01/full-mock-2026-11.json', 'utf8')),
);

const archived = parseQuestions(
  JSON.parse(readFileSync('public/courses/ans-c01/questions.json', 'utf8')),
);

for (const [id, routeCount, revision] of [
  ['ans-c01-practice-01', 3, 3],
  ['ans-c01-practice-04', 1, 3],
  ['ans-c01-practice-05', 1, 3],
  ['ans-c01-practice-06', 1, 3],
  ['ans-c01-practice-06', 1, 1],
] as const) {
  test(`ANS-C01 shows the relevant route figure after grading ${id} revision ${revision}`, async ({
    page,
  }) => {
    const question = (revision === 1 ? archived : bank).find((item) => item.id === id);
    if (!question) throw new Error(`Missing ANS-C01 question: ${id}`);
    await page.goto('/ja/study/ans-c01/');
    await page.getByRole('button', { name: messages.ja.cookieNecessary, exact: true }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する', { exact: true }).check();
    await page.evaluate(
      ({ key, selected }) => {
        localStorage.setItem(
          'katana.certification-exam.v1.ans-c01',
          JSON.stringify({
            id: crypto.randomUUID(),
            deadline: Date.now() + 3_600_000,
            order: [key],
            position: 0,
            responses: { [key]: { selected, flagged: false, durationMs: 1200 } },
          }),
        );
      },
      { key: questionKey(question), selected: question.correct },
    );
    await page.reload();
    await page.getByRole('button', { name: '模擬試験', exact: true }).click();
    await expect(page.locator('.prompt')).toHaveText(question.prompt);
    await expect(page.locator('.question-figure')).toHaveCount(0);
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する', exact: true }).click();
    await expect(page.locator('.exam-score')).toHaveText('1問中 1問正解');
    await page.getByLabel(messages.ja.includeCorrect).check();
    const review = page.locator('.exam-solutions > details');
    await review.locator('summary').first().click();
    const figure = review.locator('.question-figure');
    await expect(figure.locator('ol')).toHaveCount(routeCount);
    await expect(figure.locator('figcaption')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    if (routeCount === 3) {
      await page.setViewportSize({ width: 1280, height: 880 });
      const nodes = figure.locator('ol').first().locator('li');
      const bounds = await nodes.evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().x),
      );
      expect(bounds[1]).toBeGreaterThan(bounds[0]);
      expect(bounds[2]).toBeGreaterThan(bounds[1]);
    }
    if (routeCount === 3) {
      await page.setViewportSize({ width: 1280, height: 880 });
      const nodes = figure.locator('ol').first().locator('li');
      const bounds = await nodes.evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().x),
      );
      expect(bounds[1]).toBeGreaterThan(bounds[0]);
      expect(bounds[2]).toBeGreaterThan(bounds[1]);
    }
  });
}

test('ANS-C01 practice displays a figure only after checking the answer', async ({ page }) => {
  await page.goto('/ja/study/ans-c01/');
  await page.getByRole('button', { name: messages.ja.cookieNecessary, exact: true }).click();
  await page.getByRole('combobox', { name: messages.ja.selection, exact: true }).selectOption('0');
  await page.getByRole('button', { name: messages.ja.startStudy, exact: true }).click();
  const figure = page.locator('.question-figure');
  const illustrated = new Set([
    'ans-c01-practice-01',
    'ans-c01-practice-04',
    'ans-c01-practice-05',
    'ans-c01-practice-06',
  ]);
  const prompt = page.locator('.prompt');
  for (let index = 0; index < bank.length; index += 1) {
    await expect(prompt).toBeVisible();
    const text = await prompt.textContent();
    const question = bank.find((item) => item.prompt === text);
    if (!question) throw new Error('Displayed practice question is missing from the bank.');
    await expect(figure).toHaveCount(0);
    for (const [position, id] of question.correct.entries()) {
      if (question.format)
        await page.locator('.structured-answer-fields select').nth(position).selectOption(id);
      else await page.locator(`input[name=answer][value="${id}"]`).check();
    }
    await page.getByRole('button', { name: messages.ja.grade, exact: true }).click();
    if (illustrated.has(question.id)) {
      await expect(figure.locator('figcaption')).toBeVisible();
      return;
    }
    await expect(figure).toHaveCount(0);
    await page.getByRole('button', { name: messages.ja.next, exact: true }).click();
    await expect(prompt).not.toHaveText(question.prompt);
  }
  throw new Error('No illustrated ANS-C01 question was reached.');
});
