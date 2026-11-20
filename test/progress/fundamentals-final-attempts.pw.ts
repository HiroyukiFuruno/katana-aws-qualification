import { expect, test } from '@playwright/test';
import { finishLessonFinal, lessonAssets, walkLessonReading } from './fundamentals.helpers';

test('final scores never pool attempts and a later failed retry preserves the earlier passing receipt', async ({
  page,
}) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing first lesson.');
  await page.goto('/ja/study/fundamentals/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await page.locator('.lesson-catalog-card').first().getByRole('link').click();
  await walkLessonReading(page, asset);
  await finishLessonFinal(page, asset, 6);
  await expect(page.locator('.lesson-result-fail')).toHaveText(/未合格/);
  await page.getByRole('button', { name: 'もう一度受験する', exact: true }).click();
  await finishLessonFinal(page, asset, 6, { start: false, positions: [6, 7, 8, 9, 10, 11] });
  await expect(page.locator('.lesson-result-fail')).toHaveText(/未合格/);
  await expect(page.locator('.lesson-result-pass')).toHaveCount(0);
  await page.getByRole('button', { name: 'もう一度受験する', exact: true }).click();
  await finishLessonFinal(page, asset, 10, { start: false });
  await expect(page.locator('.lesson-result-pass')).toHaveText('合格');
  await page.getByRole('button', { name: 'もう一度受験する', exact: true }).click();
  await finishLessonFinal(page, asset, 0, { start: false });
  await expect(page.locator('.lesson-result-fail')).toHaveText(/未合格/);
  await expect(
    page.getByText('今回は不合格ですが、この単元には以前の合格記録があります。', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
  const card = page.locator('.lesson-catalog-card').first();
  await expect(card.locator('.lesson-catalog-status-passed')).toContainText('合格');
  await expect(card.locator('.lesson-catalog-prior-pass')).toBeVisible();
});
