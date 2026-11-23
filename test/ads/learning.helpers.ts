import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { parseQuestions } from '../../src/questions';

const clfQuestions = parseQuestions(
  JSON.parse(readFileSync('public/courses/clf-c02/mock-2026-11.json', 'utf8')),
);

export const viewports = [
  ['phone', 375],
  ['PC', 1000],
  ['wide', 1600],
] as const;

export async function grantAdvertisingConsent(page: Page) {
  await page.getByRole('button', { name: 'アクセス解析・広告を許可', exact: true }).click();
}

export async function selectIncorrectAnswer(page: Page) {
  const prompt = await page.locator('section[aria-labelledby="question-title"] .prompt').textContent();
  const question = clfQuestions.find((candidate) => candidate.prompt === prompt);
  if (!question) throw new Error('Could not identify the real Cloud Practitioner question.');
  const choices = question.choices
    .filter((choice) => !question.correct.includes(choice.id))
    .slice(0, question.correct.length);
  if (choices.length !== question.correct.length) throw new Error('Missing incorrect choices.');
  for (const choice of choices) await page.locator(`input[name="answer"][value="${choice.id}"]`).check();
}

export async function expectPlacements(page: Page, width: number) {
  await expect(page.locator('.site-ad--inline')).toHaveCount(1);
  await expect(page.locator('.site-ad--bottom')).toHaveCount(width === 1000 ? 1 : 0);
  await expect(page.locator('.site-ad--left, .site-ad--right')).toHaveCount(width === 1600 ? 2 : 0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(0);
}
