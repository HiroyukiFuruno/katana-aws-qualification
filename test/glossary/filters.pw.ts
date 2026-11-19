import { expect, test } from '@playwright/test';
import { glossary } from '../../src/glossary';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';

test('カテゴリ・複数タグ・検索の組み合わせとリセット', async ({ page }) => {
  await page.goto('/ja/glossary/');
  await expect(page.locator('.glossary-row')).toHaveCount(glossary.length);
  await page.getByLabel('カテゴリ', { exact: true }).selectOption('storage');
  const filters = page.getByRole('group', { name: 'タグ', exact: true });
  await filters.getByRole('button', { name: '暗号化', exact: true }).click();
  await filters.getByRole('button', { name: 'データ保護', exact: true }).click();
  await expect(page.locator('#glossary-term-sse-kms')).toBeVisible();
  await expect(page.locator('#glossary-term-ec2')).toHaveCount(0);
  await page.getByLabel('用語を検索').fill('SSE-KMS');
  await expect(page.locator('.glossary-row')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText('1 /');
  await page.getByLabel('用語を検索').fill('存在しない用語');
  await expect(page.getByText('一致する用語はありません。')).toBeVisible();
  await page.getByRole('button', { name: '絞り込みを解除' }).click();
  await expect(page.locator('.glossary-row')).toHaveCount(glossary.length);
  await expect(filters.getByRole('button', { pressed: true })).toHaveCount(0);
});

test('関連用語リンクがフィルターを解除してリンク先へ移動する', async ({ page }) => {
  await page.goto('/ja/glossary/');
  await page.getByLabel('カテゴリ', { exact: true }).selectOption('compute');
  await page.getByLabel('用語を検索').fill('Lambda');
  await page.locator('.glossary-row dd').getByRole('link', { name: 'S3', exact: true }).click();
  await expect(page.locator('#glossary-term-s3')).toBeInViewport();
  await expect(page.getByLabel('用語を検索')).toHaveValue('');
  await expect(page.getByLabel('カテゴリ', { exact: true })).toHaveValue('');
});

test('320pxで横にはみ出さず、タグをキーボード操作できる', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/ja/glossary/');
  const button = page.getByRole('group', { name: 'タグ', exact: true }).getByRole('button').first();
  await button.focus();
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('用語の分類表示から絞り込み、タグを再選択して解除できる', async ({ page }) => {
  await page.goto('/ja/glossary/');
  const lambda = page.locator('.glossary-row').filter({ has: page.locator('#glossary-term-lambda') });
  await lambda.getByRole('button', { name: 'コンピューティング', exact: true }).click();
  await expect(page.getByLabel('カテゴリ', { exact: true })).toHaveValue('compute');
  await lambda.getByRole('button', { name: 'サーバーレス', exact: true }).click();
  await expect(page.locator('.glossary-row')).toHaveCount(1);
  const tag = page
    .getByRole('group', { name: 'タグ', exact: true })
    .getByRole('button', { name: 'サーバーレス', exact: true });
  await expect(tag).toHaveAttribute('aria-pressed', 'true');
  await tag.click();
  await expect(page.locator('.glossary-row')).toHaveCount(
    glossary.filter((entry) => entry.category === 'compute').length,
  );
});

test('全10言語で絞り込み文言と狭幅表示を検証する', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  for (const locale of locales) {
    const labels = messages[locale];
    await page.goto(localePath(locale, 'glossary'));
    await page.getByLabel(labels.glossaryCategory, { exact: true }).selectOption('ai');
    const tags = page.getByRole('group', { name: labels.glossaryTags, exact: true });
    await tags.getByRole('button', { name: labels.glossaryGenerativeAi, exact: true }).click();
    await expect(page.locator('#glossary-term-bedrock')).toBeVisible();
    await expect(page.locator('#glossary-term-sagemaker-ai')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await page.getByRole('button', { name: labels.glossaryReset, exact: true }).click();
    await expect(page.locator('.glossary-row')).toHaveCount(glossary.length);
  }
});
