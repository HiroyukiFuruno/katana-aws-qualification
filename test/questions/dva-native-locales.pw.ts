import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { type Locale, locales } from '../../src/locales';
import { messages } from '../../src/messages';
import { type Question, questionKey } from '../../src/questions';

test('DVA natural translations preserve choices and grading across all ten languages', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const banks = new Map<Locale, Question[]>();
  for (const locale of locales) {
    const root = locale === 'ja' ? 'public' : `public/translations/${locale}`;
    banks.set(locale, JSON.parse(await readFile(`${root}/courses/dva-c03/mock-2026-11.json`, 'utf8')));
  }
  await page.goto('/ja/study/dva-c03/');
  await page.getByRole('button', { name: messages.ja.cookieNecessary, exact: true }).click();
  await page.getByRole('combobox', { name: messages.ja.selection, exact: true }).selectOption('0');
  await page.getByRole('button', { name: messages.ja.startStudy, exact: true }).click();
  const card = page.locator('section[aria-labelledby="question-title"]');
  const prompt = card.locator('.prompt');
  await expect(prompt).toBeVisible();
  const text = await prompt.textContent();
  const matches = banks.get('ja')?.filter((question) => question.prompt === text) ?? [];
  expect(matches).toHaveLength(1);
  const source = matches[0];
  const inputs = card.locator('input[name="answer"]');
  const order = await inputs.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLInputElement).value),
  );
  await inputs.first().check();
  let current: Locale = 'ja';
  async function verify(locale: Locale, selected: readonly string[], graded: boolean) {
    await page
      .getByRole('combobox', { name: messages[current].language, exact: true })
      .selectOption(locale);
    const translated = banks
      .get(locale)
      ?.find((question) => questionKey(question) === questionKey(source));
    if (!translated) throw new Error(`Missing DVA translation: ${locale}/${source.id}`);
    await expect(prompt).toHaveText(translated.prompt);
    expect(
      await inputs.evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value)),
    ).toEqual(order);
    await expect(card.locator('.choice > span[lang]')).toHaveText(
      order.map((id) => {
        const choice = translated.choices.find((candidate) => candidate.id === id);
        if (!choice) throw new Error(`Missing DVA choice: ${id}`);
        return choice.text;
      }),
    );
    for (const id of selected)
      await expect(card.locator(`input[name="answer"][value="${id}"]`)).toBeChecked();
    if (graded) {
      await expect(card.locator('#question-title')).toHaveText(translated.title);
      await expect(card.locator('.good-text')).toContainText(messages[locale].correct);
      await expect(card.locator('.explanation > span[lang]')).toHaveText(
        order.map((id) => {
          const choice = translated.choices.find((candidate) => candidate.id === id);
          if (!choice) throw new Error(`Missing DVA explanation: ${id}`);
          return choice.explanation;
        }),
      );
    }
    const visible = await card.textContent();
    if (locale !== 'ja') {
      expect(visible).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
      if (!locale.startsWith('zh')) expect(visible).not.toMatch(/\p{Script=Han}/u);
    }
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    current = locale;
  }
  for (const locale of locales) await verify(locale, [order[0]], false);
  if (source.correct.length > 1 && !source.correct.includes(order[0])) await inputs.first().uncheck();
  for (const id of source.correct) await card.locator(`input[name="answer"][value="${id}"]`).check();
  await card.getByRole('button', { name: messages[current].grade, exact: true }).click();
  await expect(card.locator('.good-text')).toBeVisible();
  for (const locale of [...locales, 'ja'] as Locale[]) await verify(locale, source.correct, true);
  expect(errors).toEqual([]);
});
