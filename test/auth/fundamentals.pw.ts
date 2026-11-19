import { expect, test } from '@playwright/test';
import content from '../../public/fundamentals/content.json' with { type: 'json' };
import { localePath, locales } from '../../src/locales';
import { answer } from './fundamentals-helpers';

const units = content.units;

test('all four question formats are answerable and progress survives reload', async ({ page }) => {
  expect(units.reduce((count, unit) => count + unit.questions.length, 0)).toBe(12);
  const seen = new Set<string>();
  for (const unit of units) {
    await page.goto(`/ja/study/fundamentals/?unit=${encodeURIComponent(unit.id)}`);
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
  }
  expect([...seen].sort()).toEqual(['correct:1', 'correct:2', 'incorrect:1', 'incorrect:2']);
  await page.goto('/ja/study/fundamentals/');
  const first = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: units[0].title }) });
  const status = await first.locator('.fundamentals-status').textContent();
  expect(status).not.toContain('未学習');
  await page.reload();
  await expect(first.locator('.fundamentals-status')).toHaveText(status ?? '');
});

test('review retains its original queue after an answer is corrected', async ({ page }) => {
  const unit = units[0];
  expect(unit.questions.length).toBeGreaterThanOrEqual(2);
  await page.goto(`/ja/study/fundamentals/?unit=${encodeURIComponent(unit.id)}`);
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

test('planned units cannot be started, including by direct URL', async ({ page }) => {
  await page.goto('/ja/study/fundamentals/');
  for (const item of content.catalog.filter((entry) => entry.state === 'planned')) {
    await page.goto('/ja/study/fundamentals/');
    const card = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: item.title }) });
    await expect(card).toContainText('教材は準備中');
    await expect(card.getByRole('button')).toHaveCount(0);
    await page.goto(`/ja/study/fundamentals/?unit=${encodeURIComponent(item.id)}`);
    await expect(page.locator('.fundamentals-question')).toHaveCount(0);
  }
});

test('all locales expose the fundamentals route on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const locale of locales) {
    await page.goto(localePath(locale));
    const route = localePath(locale, 'study/fundamentals');
    await page.locator('.study-navigation-toggle').click();
    const link = page.locator(`a[href="${route}"]:visible`).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
    await expect(page.locator('.fundamentals-catalog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  }
});
