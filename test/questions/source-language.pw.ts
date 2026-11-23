import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { localePath } from '../../src/locales';
import { messages } from '../../src/messages';

for (const scenario of [
  {
    course: 'scs-c03',
    ui: 'en',
    source: 'ja',
    sourcePath: '../../public/courses/scs-c03/full-mock-2026-11.json',
    translationPath: '../../public/translations/en/courses/scs-c03/full-mock-2026-11.json',
  },
  {
    course: 'mla-c02',
    ui: 'ja',
    source: 'en',
    sourcePath: '../../public/courses/mla-c02/mock-2026-11.json',
    translationPath: '../../public/translations/ja/courses/mla-c02/mock-2026-11.json',
  },
] as const) {
  test(`${scenario.course}: translated questions expose UI language and preserve canonical answer order`, async ({
    page,
  }) => {
    const { course, ui, source } = scenario;
    const notice = (locale: typeof ui | typeof source) =>
      messages[locale].questionTranslationPreparing.replace(
        '{language}',
        new Intl.DisplayNames(locale, { type: 'language' }).of(source) as string,
      );
    const sourceQuestions = JSON.parse(
      await readFile(new URL(scenario.sourcePath, import.meta.url), 'utf8'),
    ) as {
      id: string;
      revision: number;
      format?: string;
      choices: { id: string }[];
      prompt: string;
    }[];
    const translatedQuestions = JSON.parse(
      await readFile(new URL(scenario.translationPath, import.meta.url), 'utf8'),
    ) as { id: string; revision: number; prompt: string }[];
    await page.goto(localePath(ui, `study/${course}`));
    await expect(page.getByText(notice(ui), { exact: true })).toHaveCount(0);
    if (ui !== 'ja')
      await expect(page.getByText(messages[ui].contentLanguage, { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: messages[ui].selection, exact: true }).selectOption('0');
    await page.getByRole('button', { name: messages[ui].startStudy, exact: true }).click();
    const prompt = page.locator('.prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveAttribute('lang', ui);
    const translatedPrompt = await prompt.textContent();
    if (!translatedPrompt) throw new Error('Question prompt is empty');
    const translatedMatches = translatedQuestions.filter(({ prompt }) => prompt === translatedPrompt);
    expect(translatedMatches).toHaveLength(1);
    const translatedQuestion = translatedMatches[0];
    const sourceMatches = sourceQuestions.filter(
      ({ id, revision }) =>
        `${id}@${revision}` === `${translatedQuestion.id}@${translatedQuestion.revision}`,
    );
    expect(sourceMatches).toHaveLength(1);
    const sourceQuestion = sourceMatches[0];
    const choices = page.locator('input[name=answer]');
    const structuredChoices = page.locator('.structured-answer-fields select').first();
    const order = sourceQuestion.format
      ? await structuredChoices
          .locator('option')
          .evaluateAll((options) =>
            options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
          )
      : await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect([...order].sort()).toEqual([...sourceQuestion.choices.map(({ id }) => id)].sort());
    const selectedOption = sourceQuestion.format
      ? await structuredChoices.locator('option:not([value=""])').first().getAttribute('value')
      : undefined;
    if (sourceQuestion.format && !selectedOption)
      throw new Error('Structured question has no selectable choice');
    const selected = selectedOption ?? (await choices.first().inputValue());
    if (sourceQuestion.format) await structuredChoices.selectOption(selected);
    else await choices.first().check();
    await page.getByRole('combobox', { name: messages[ui].language, exact: true }).selectOption(source);
    await expect(page.getByText(notice(source), { exact: true })).toHaveCount(0);
    await expect(prompt).toHaveAttribute('lang', source);
    await expect(prompt).toHaveText(sourceQuestion.prompt);
    if (sourceQuestion.format) await expect(structuredChoices).toHaveValue(selected);
    else await expect(page.locator(`input[name=answer][value="${selected}"]`)).toBeChecked();
    await page.getByRole('combobox', { name: messages[source].language, exact: true }).selectOption(ui);
    await expect(page.getByText(notice(ui), { exact: true })).toHaveCount(0);
    await expect(prompt).toHaveAttribute('lang', ui);
    await expect(prompt).toHaveText(translatedQuestion.prompt);
    if (sourceQuestion.format) await expect(structuredChoices).toHaveValue(selected);
    else await expect(page.locator(`input[name=answer][value="${selected}"]`)).toBeChecked();
    const returnedOrder = sourceQuestion.format
      ? await structuredChoices
          .locator('option')
          .evaluateAll((options) =>
            options.map((option) => (option as HTMLOptionElement).value).filter(Boolean),
          )
      : await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(returnedOrder).toEqual(order);
  });
}
