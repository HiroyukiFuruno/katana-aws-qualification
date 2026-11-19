import { expect, type Page } from '@playwright/test';

export async function answer(page: Page, choices: string[], last?: boolean) {
  const card = page.locator('.fundamentals-question');
  for (const [index, choice] of choices.entries()) {
    await card
      .locator('label')
      .filter({ has: page.locator('.letter', { hasText: choice }) })
      .click();
    if (index < choices.length - 1) {
      await expect(card.getByRole('button', { name: '採点する' })).toBeDisabled();
    }
  }
  if (choices.length > 1) {
    for (const input of await card.locator('input:not(:checked)').all())
      await expect(input).toBeDisabled();
  }
  await card.getByRole('button', { name: '採点する' }).click();
  await expect(card.getByRole('status')).toBeVisible();
  await expect(card.locator('.learning-notes')).toBeVisible();
  await expect(card.locator('.learning-notes a').first()).toHaveAttribute('href', /^https:\/\//);
  if (last !== undefined) {
    await card.getByRole('button', { name: last ? '結果を見る' : '次の問題へ' }).click();
  }
}
