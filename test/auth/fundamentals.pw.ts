import { expect, test } from '@playwright/test';
import content from '../../public/fundamentals/content.json' with { type: 'json' };
import { localePath, locales } from '../../src/locales';
import { answer, startPractice } from './fundamentals-helpers';

const units = content.units;

for (const unit of units) {
  test(`${unit.id}: read first, answer all four formats and retain progress`, async ({ page }) => {
    await page.goto(`/ja/study/fundamentals/?unit=${encodeURIComponent(unit.id)}`);
    await expect(page.locator('.fundamentals-reading-section')).toHaveCount(unit.sections.length);
    for (const section of unit.sections) {
      await expect(page.getByRole('heading', { name: section.title, exact: true })).toBeVisible();
      await expect(page.getByText(section.paragraphs[0], { exact: true })).toBeVisible();
    }
    await startPractice(page);
    const seen = new Set<string>();
    for (const [index, question] of unit.questions.entries()) {
      seen.add(`${question.selectionPolarity}:${question.requiredChoices}`);
      const card = page.locator('.fundamentals-question');
      await expect(card.locator('.prompt')).toHaveText(question.prompt);
      await expect(card.locator('input:checked')).toHaveCount(0);
      await expect(card.getByRole('button', { name: '採点する' })).toBeDisabled();
      await expect(card.locator('input')).toHaveCount(question.choices.length);
      await answer(page, question.correct, index === unit.questions.length - 1);
    }
    await expect(page.locator('#fundamentals-results')).toBeVisible();
    if (!units.some((candidate) => candidate.id === unit.next)) {
      await expect(page.getByRole('button', { name: '次の単元へ' })).toHaveCount(0);
    }
    expect([...seen].sort()).toEqual(['correct:1', 'correct:2', 'incorrect:1', 'incorrect:2']);
    await page.goto('/ja/study/fundamentals/');
    const catalog = content.catalog.find((item) => item.id === unit.id);
    if (!catalog) throw new Error(`Missing catalog entry for ${unit.id}`);
    const first = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: catalog.title }) });
    await expect(first.locator('.fundamentals-status')).toContainText('完了');
    await page.reload();
    await expect(first.locator('.fundamentals-status')).toContainText('完了');
  });
}

test('related reading preserves an ungraded selection and a graded result', async ({ page }) => {
  const unit = units[0];
  const question = unit.questions[0];
  const section = unit.sections.find((item) => item.id === question.sectionId);
  if (!section) throw new Error(`Missing section for ${question.id}`);
  await page.goto(`/ja/study/fundamentals/?unit=${encodeURIComponent(unit.id)}`);
  await startPractice(page);
  const card = page.locator('.fundamentals-question');
  await card
    .locator('label')
    .filter({ has: page.locator('.letter', { hasText: question.correct[0] }) })
    .click();
  const related = page.locator('.fundamentals-reading-return');
  await related.locator('summary').click();
  await expect(related.getByText(section.paragraphs[0], { exact: true })).toBeVisible();
  await expect(related.locator('a').first()).toHaveAttribute('href', /^https:\/\//);
  await expect(card.locator('input:checked')).toHaveCount(1);
  await related.locator('summary').click();
  await expect(related).not.toHaveAttribute('open', '');
  await expect(card.locator('input:checked')).toHaveCount(1);
  await card.getByRole('button', { name: '採点する' }).click();
  await expect(card.getByRole('status')).toBeVisible();
  await related.locator('summary').click();
  await expect(card.getByRole('status')).toBeVisible();
  await expect(card.locator('.learning-notes')).toBeVisible();
  await expect(card.locator('input:checked')).toHaveCount(1);
});

test('review retains its original queue after an answer is corrected', async ({ page }) => {
  const unit = units[0];
  expect(unit.questions.length).toBeGreaterThanOrEqual(2);
  await page.goto(`/ja/study/fundamentals/?unit=${encodeURIComponent(unit.id)}`);
  await startPractice(page);
  for (const [index, question] of unit.questions.entries()) {
    const wrong = question.choices.filter((choice) => !question.correct.includes(choice.id));
    const selected = [...question.correct.slice(0, -1), wrong[0].id];
    await answer(page, selected, index === unit.questions.length - 1);
  }
  await page.getByRole('button', { name: '復習' }).click();
  await expect(page.locator('.fundamentals-question .prompt')).toHaveText(unit.questions[0].prompt);
  await answer(page, unit.questions[0].correct, false);
  await expect(page.locator('.fundamentals-question .prompt')).toHaveText(unit.questions[1].prompt);
  for (const [index, question] of unit.questions.slice(1).entries()) {
    await answer(page, question.correct, index === unit.questions.length - 2);
  }
  await expect(page.locator('#fundamentals-results')).toBeVisible();
  await expect(page.locator('.fundamentals-question')).toHaveCount(0);
});

test('every catalog unit offers reading and a practice entry', async ({ page }) => {
  expect(content.catalog).toHaveLength(12);
  expect(content.catalog.every((entry) => entry.state === 'published')).toBe(true);
  await page.goto('/ja/study/fundamentals/');
  for (const item of content.catalog) {
    const card = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: item.title }) });
    await expect(card.getByRole('button', { name: 'この単元を学ぶ' })).toBeVisible();
  }
  const unit = units.at(-1);
  const item = content.catalog.at(-1);
  if (!unit || !item) throw new Error('Missing final fundamentals unit');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: item.title }) });
  await card.getByRole('button', { name: 'この単元を学ぶ' }).click();
  const heading = page.getByRole('heading', { name: unit.title, exact: true });
  await expect(heading).toBeInViewport();
  await expect(heading).toBeFocused();
});

for (const width of [320, 390]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const locale of locales) {
      test(`fundamentals route ${locale} at ${width}px in ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme });
        await page.goto(localePath(locale));
        const route = localePath(locale, 'study/fundamentals');
        await page.locator('.study-navigation-toggle').click();
        const link = page.locator(`a[href="${route}"]:visible`).first();
        await expect(link).toBeVisible();
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
        await expect(page.locator('.fundamentals-catalog article button.primary').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      });
    }
  }
}
