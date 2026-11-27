import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import { parseQuestions, questionKey } from '../../src/questions';

const bank = parseQuestions(
  JSON.parse(readFileSync('public/courses/ans-c01/full-mock-2026-11.json', 'utf8')),
);

for (const [id, routeCount] of [
  ['ans-c01-practice-01', 3],
  ['ans-c01-practice-04', 1],
  ['ans-c01-practice-05', 1],
  ['ans-c01-practice-06', 1],
] as const) {
  test(`ANS-C01 shows the relevant route figure after grading ${id}`, async ({ page }) => {
    const question = bank.find((item) => item.id === id);
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
