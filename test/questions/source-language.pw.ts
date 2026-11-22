import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import { type Locale, localePath } from '../../src/locales';

for (const scenario of [
  { course: 'scs-c03', ui: 'en', source: 'ja' },
  { course: 'mla-c02', ui: 'ja', source: 'en' },
] as const) {
  test(`${scenario.course}: source-only questions disclose their language and preserve a selected answer`, async ({
    page,
  }) => {
    const { course, ui, source } = scenario;
    const notice = (locale: Locale) =>
      messages[locale].questionTranslationPreparing.replace(
        '{language}',
        new Intl.DisplayNames(locale, { type: 'language' }).of(source) as string,
      );
    await page.goto(localePath(ui, `study/${course}`));
    await expect(page.getByText(notice(ui), { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(notice(ui), { exact: true })).toBeVisible();
    await expect(page.getByText(messages[ui].contentLanguage, { exact: true })).toHaveCount(0);
    await page.getByRole('combobox', { name: messages[ui].selection, exact: true }).selectOption('0');
    await page.getByRole('button', { name: messages[ui].startStudy, exact: true }).click();
    const prompt = page.locator('.prompt');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveAttribute('lang', source);
    const originalPrompt = await prompt.textContent();
    if (!originalPrompt) throw new Error('Question prompt is empty');
    const choices = page.locator('input[name=answer]');
    const order = await choices.evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
    const selected = await choices.first().inputValue();
    await choices.first().check();
    await page.getByRole('combobox', { name: messages[ui].language, exact: true }).selectOption(source);
    await expect(page.getByText(notice(source), { exact: true })).toHaveCount(0);
    await expect(prompt).toHaveText(originalPrompt);
    await expect(page.locator(`input[name=answer][value="${selected}"]`)).toBeChecked();
    await page.getByRole('combobox', { name: messages[source].language, exact: true }).selectOption(ui);
    await expect(page.getByText(notice(ui), { exact: true })).toBeVisible();
    await expect(prompt).toHaveText(originalPrompt);
    expect(
      await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
    ).toEqual(order);
  });
}
