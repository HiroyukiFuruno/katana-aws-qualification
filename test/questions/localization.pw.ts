import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { type Locale, locales } from '../../src/locales';
import { messages } from '../../src/messages';

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Maximum update depth exceeded'))
      errors.push(message.text());
  });
});
test.afterEach(({ page }) => expect(runtimeErrors.get(page)).toEqual([]));

test('fixed practice preserves an unsubmitted answer, question and choice order through locale changes', async ({
  page,
}) => {
  await page.goto('/ja/study/clf-c02/');
  await page.getByRole('combobox', { name: '出題方法', exact: true }).selectOption('0');
  await page.getByRole('button', { name: '学習を始める', exact: true }).click();
  const prompt = page.locator('.prompt');
  await expect(prompt).toBeVisible();
  const japanesePrompt = await prompt.textContent();
  if (!japanesePrompt) throw new Error('Missing question prompt');
  const choices = page.locator('input[name=answer]');
  const order = await choices.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
  await choices.first().check();
  const selectedId = await choices.first().inputValue();
  const letters = page.locator('.choice .letter');
  expect(await letters.allTextContents()).toEqual(
    order.map((_, index) => String.fromCodePoint(65 + index)),
  );
  await page.getByRole('combobox', { name: '言語', exact: true }).selectOption('en');
  await expect(prompt).not.toHaveText(japanesePrompt);
  await expect(page.locator(`input[name=answer][value="${selectedId}"]`)).toBeChecked();
  expect(
    await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
  ).toEqual(order);
  expect(await prompt.textContent()).not.toMatch(
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  );
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ja');
  await expect(prompt).toHaveText(japanesePrompt);
  await expect(page.locator(`input[name=answer][value="${selectedId}"]`)).toBeChecked();
  await expect(page.locator('main .progress')).toContainText('第 1 問 / 65 問');
});

test('localized certification and glossary content is external and Japanese-free in French', async ({
  page,
}) => {
  await page.goto('/fr/certifications/clf-c02/');
  await expect(page.getByRole('heading', { name: 'Ce que vous apprendrez', exact: true })).toBeVisible();
  expect(await page.locator('article').textContent()).not.toMatch(
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  );
  await page.getByRole('link', { name: 'Glossaire AWS', exact: true }).first().click();
  await expect(page.locator('.glossary-groups dl')).not.toHaveCount(0);
  expect(await page.locator('.glossary-groups').textContent()).not.toMatch(
    /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  );
});

test('assessment preserves canonical choices and presentation order when the language changes', async ({
  page,
}) => {
  await page.goto('/ja/assessment/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.getByRole('button', { name: /スキル査定を始める/ }).click();
  const choices = page.locator('.roadmap-card input[type=radio]');
  await expect(choices.first()).toBeVisible();
  const identity = await choices.first().getAttribute('name');
  const order = await choices.evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
  const selected = await choices.first().inputValue();
  await choices.first().check();
  await expect(page.getByRole('button', { name: '次の問題へ', exact: true })).toBeEnabled();
  let currentLocale: Locale = 'ja';
  for (const locale of [...locales, 'ja'] as Locale[]) {
    await page
      .getByRole('combobox', { name: messages[currentLocale].language, exact: true })
      .selectOption(locale);
    const path =
      locale === 'ja' ? '../../src/content/ja.json' : `../../public/translations/${locale}/site.json`;
    const content = JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')) as {
      assessment: { id: string; prompt: string; options: string[] }[];
    };
    const item = content.assessment.find((question) => question.id === identity);
    if (!item) throw new Error(`Missing assessment translation: ${locale}/${identity}`);
    await expect(page.locator('.roadmap-card h2')).toHaveText(item.prompt);
    await expect(page.locator(`input[name="${identity}"][value="${selected}"]`)).toBeChecked();
    expect(
      await choices.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
    ).toEqual(order);
    await expect(page.locator('.roadmap-card .choice span')).toHaveText(
      order.map((value) =>
        Number(value) === item.options.length ? messages[locale].unknown : item.options[Number(value)],
      ),
    );
    await expect(page.locator('.roadmap-card button.primary')).toBeEnabled();
    const text = await page.locator('.roadmap-card').textContent();
    if (locale !== 'ja') {
      expect(text).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
      if (!locale.startsWith('zh')) expect(text).not.toMatch(/\p{Script=Han}/u);
    }
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    currentLocale = locale;
  }
});
