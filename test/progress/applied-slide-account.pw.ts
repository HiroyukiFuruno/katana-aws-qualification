import { expect, test } from '@playwright/test';
import { activeUserId, createSessions, setRealSession } from './sessions';

const slides = '/ja/study/applied/private-app-s3/slides/';
const firstHeading = '利用者からアプリまでの経路';
const secondHeading = 'アプリからS3へ出る経路';

test('同じブラウザでサインインした利用者を変えても事例の再開位置を共有しない', async ({ page }) => {
  const [first, second] = await createSessions();
  await page.goto(slides);
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await setRealSession(page, first);
  await expect.poll(() => activeUserId(page)).toBe(first.userId);
  await page.reload();
  await expect(page.getByRole('heading', { name: firstHeading })).toBeVisible();
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('heading', { name: secondHeading })).toBeVisible();

  await setRealSession(page, second);
  await expect.poll(() => activeUserId(page)).toBe(second.userId);
  await page.reload();
  await expect(page.getByRole('heading', { name: firstHeading })).toBeVisible();

  await setRealSession(page, first);
  await expect.poll(() => activeUserId(page)).toBe(first.userId);
  await page.reload();
  await expect(page.getByRole('heading', { name: secondHeading })).toBeVisible();
});
