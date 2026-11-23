import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { localePath } from '../../src/locales';
import { messages } from '../../src/messages';
import { type Question, questionKey } from '../../src/questions';
import { shuffle } from '../../src/randomization';

const sourcePath = '../../public/courses/scs-c03/full-mock-2026-11.json';
const englishPath = '../../public/translations/en/courses/scs-c03/full-mock-2026-11.json';
const examStorageKey = 'katana.certification-exam.v1.scs-c03';

for (const format of ['ordering', 'matching'] as const) {
  test(`SCS ${format} preserves shuffled structured choices across EN-JA-EN`, async ({ page }) => {
    const sourceQuestions = JSON.parse(
      await readFile(new URL(sourcePath, import.meta.url), 'utf8'),
    ) as Question[];
    const englishQuestions = JSON.parse(
      await readFile(new URL(englishPath, import.meta.url), 'utf8'),
    ) as Question[];
    const candidates = sourceQuestions.filter((question) => question.format === format);
    expect(candidates.length).toBeGreaterThan(0);
    const sourceQuestion = candidates[0];
    const key = questionKey(sourceQuestion);
    const englishMatches = englishQuestions.filter((question) => questionKey(question) === key);
    expect(englishMatches).toHaveLength(1);
    const englishQuestion = englishMatches[0];
    let choiceOrder = shuffle(sourceQuestion.choices).map(({ id }) => id);
    const canonicalOrder = sourceQuestion.choices.map(({ id }) => id);
    if (choiceOrder.length > 1 && choiceOrder.every((id, index) => id === canonicalOrder[index])) {
      // saved-inputの非canonical順を保証し、choiceOrderを無視する回帰を検出する。
      choiceOrder = [...choiceOrder.slice(1), choiceOrder[0]];
    }

    await page.goto(localePath('en', 'study/scs-c03'));
    await page.getByRole('button', { name: messages.en.cookieNecessary, exact: true }).click();
    await page.getByLabel(messages.en.progressStorageAllow, { exact: true }).check();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('katana.learning-progress-consent.v1')))
      .toBe('granted');
    await page.evaluate(
      ({ examStorageKey, key, choiceOrder }) => {
        localStorage.setItem(
          examStorageKey,
          JSON.stringify({
            id: crypto.randomUUID(),
            deadline: Date.now() + 3_600_000,
            order: [key],
            position: 0,
            choiceOrders: { [key]: choiceOrder },
            responses: {},
          }),
        );
      },
      { examStorageKey, key, choiceOrder },
    );
    await page.reload();
    await page
      .locator('.course-nav')
      .getByRole('button', { name: messages.en.exam, exact: true })
      .click();
    const prompt = page.locator('.prompt');
    await expect(prompt).toHaveText(englishQuestion.prompt);
    await expect(prompt).toHaveAttribute('lang', 'en');

    const fields = page.locator('.structured-answer-fields select');
    await expect(fields).toHaveCount(sourceQuestion.correct.length);
    const initialOptionOrder = await fields
      .first()
      .locator('option:not([value=""])')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(initialOptionOrder).toEqual(choiceOrder);
    expect([...initialOptionOrder].sort()).toEqual([...choiceOrder].sort());
    const selected: string[] = [];
    for (let index = 0; index < (await fields.count()); index += 1) {
      const field = fields.nth(index);
      const available = await field
        .locator('option:not([value=""]):not(:disabled)')
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
      const value = available[0];
      if (!value) throw new Error(`No available choice for ${format} slot ${index}`);
      await field.selectOption(value);
      await expect(field).toHaveValue(value);
      selected.push(value);
    }

    await page.getByRole('combobox', { name: messages.en.language, exact: true }).selectOption('ja');
    await expect(prompt).toHaveText(sourceQuestion.prompt);
    await expect(prompt).toHaveAttribute('lang', 'ja');
    await expect(fields).toHaveCount(sourceQuestion.correct.length);
    for (const [index, value] of selected.entries()) await expect(fields.nth(index)).toHaveValue(value);
    const japaneseOptionOrder = await fields
      .first()
      .locator('option:not([value=""])')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(japaneseOptionOrder).toEqual(initialOptionOrder);

    await page.getByRole('combobox', { name: messages.ja.language, exact: true }).selectOption('en');
    await expect(prompt).toHaveText(englishQuestion.prompt);
    await expect(prompt).toHaveAttribute('lang', 'en');
    for (const [index, value] of selected.entries()) await expect(fields.nth(index)).toHaveValue(value);
    const returnedOptionOrder = await fields
      .first()
      .locator('option:not([value=""])')
      .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
    expect(returnedOptionOrder).toEqual(initialOptionOrder);
  });
}
