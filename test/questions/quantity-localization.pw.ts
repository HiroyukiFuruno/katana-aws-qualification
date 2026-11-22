import { expect, test } from '@playwright/test';

test('question count uses singular and plural variants after a real locale switch', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/study/saa-c03/');

  const picker = page.locator('.question-set-picker').first();
  const count = picker.locator('select').nth(1);
  await expect(count.locator('option[value="1"]')).toHaveText('1 question');
  await expect(count.locator('option[value="2"]')).toHaveText('2 questions');

  await page.locator('#site-locale').selectOption('es');
  await expect(page).toHaveURL('/es/study/saa-c03/');
  await expect(count.locator('option[value="1"]')).toHaveText('1 pregunta');
  await expect(count.locator('option[value="2"]')).toHaveText('2 preguntas');
  expect(errors).toEqual([]);
});
