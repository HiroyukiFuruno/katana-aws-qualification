import { expect, type Page, test } from '@playwright/test';
import { startStudy } from './course';
import { allowGuestStorage, historyKey } from './guest-exam.helpers';

async function selectAnswer(page: Page) {
  const grade = page.getByRole('button', { name: '採点する' });
  const choices = page.locator('input[name="answer"]');
  for (let index = 0; index < (await choices.count()); index += 1) {
    if (await grade.isEnabled()) return;
    await choices.nth(index).check();
  }
  await expect(grade).toBeEnabled();
}

async function grade(page: Page) {
  await page.getByRole('button', { name: '採点する' }).click();
  await expect(
    page.locator('section[aria-labelledby="question-title"]').getByRole('status'),
  ).toBeVisible();
}

test('two consented tabs append separate answers from the same stale history', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const first = await context.newPage();
    await first.goto('/ja/study/saa-c03/');
    await allowGuestStorage(first);
    await startStudy(first);
    await selectAnswer(first);
    await grade(first);
    await first.getByRole('button', { name: '次の問題' }).click();

    const second = await context.newPage();
    await second.goto('/ja/study/saa-c03/');
    await startStudy(second);
    await Promise.all([selectAnswer(first), selectAnswer(second)]);
    await Promise.all([grade(first), grade(second)]);
    await expect
      .poll(() =>
        first.evaluate((key) => {
          const raw = localStorage.getItem(key);
          return raw ? (JSON.parse(raw) as unknown[]).length : 0;
        }, historyKey),
      )
      .toBe(3);
    await first.reload();
    await expect(first.locator('.metrics strong').first()).toHaveText('3');
  } finally {
    await context.close();
  }
});
