import { expect, type Page, test } from '@playwright/test';

const directory = '/ja/study/applied/';
const article = `${directory}private-app-s3/`;
const slides = `${article}slides/`;
const firstHeading = '利用者からアプリまでの経路';
const secondHeading = 'アプリからS3へ出る経路';
const reviewHeading = '片方のAZからS3へ接続できない場合';
const reviewShown = '解説を表示しました';
const response = 'AZ B のルートテーブルを確認します。片方の AZ に影響が限られているためです。';

async function allowNecessaryCookies(page: Page) {
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
}

async function openStudyMenu(page: Page) {
  const toggle = page.getByRole('button', { name: '学ぶ', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  return page.locator('#study-navigation-links');
}

test('320pxで学ぶメニューから応用学習を開き、AWSサービスを選べる', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ja/study/');
  await allowNecessaryCookies(page);
  const menu = await openStudyMenu(page);
  await expect(menu.getByRole('link', { name: '応用学習', exact: true })).toHaveAttribute(
    'href',
    directory,
  );
  await menu.getByRole('link', { name: '応用学習', exact: true }).click();
  await expect(page).toHaveURL(directory);
  await openStudyMenu(page);
  await expect(menu.getByRole('link', { name: '応用学習', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(menu.getByRole('link', { name: '資格別の問題と模試', exact: true })).not.toHaveAttribute(
    'aria-current',
  );
  await page.keyboard.press('Escape');

  const filters = page.getByRole('region', { name: 'AWSサービスから探す' });
  await filters.getByRole('button', { name: 'Amazon VPC', exact: true }).click();
  await expect(filters.getByRole('button', { name: 'Amazon VPC', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const cases = page.locator('.applied-case .entry-card');
  await expect(cases).toHaveCount(1);
  await expect(cases.getByRole('link', { name: 'スライドで読む', exact: true })).toHaveAttribute(
    'href',
    slides,
  );
  await filters.getByRole('button', { name: 'すべて', exact: true }).click();
  await expect(cases).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('ゲストの同意後にスライドと回答を保存し、解説表示に学習完了を付けない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(article);
  await allowNecessaryCookies(page);
  const launch = page.getByRole('main').getByRole('link', { name: 'スライドで読む', exact: true });
  await expect(launch).toHaveAttribute('href', slides);
  await launch.click();
  await expect(page).toHaveURL(slides);
  await expect(page.getByRole('heading', { name: firstHeading })).toBeVisible();
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();

  const next = page.getByRole('button', { name: '次へ', exact: true });
  await next.click();
  await expect(page.getByRole('heading', { name: secondHeading })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: secondHeading })).toBeVisible();

  const egress = 'インターネットへの発信も必要になったら';
  await page.goto(`${slides}?step=s3-route`);
  await next.click();
  await expect(page.getByRole('heading', { name: egress })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: egress })).toBeVisible();
  await expect(page).toHaveURL(slides);
  await page.goto(`${slides}?step=additional-egress`);
  await page.getByRole('link', { name: '前へ', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: secondHeading })).toBeVisible();

  await page.goto(`${slides}?step=verify`);
  await expect(page.getByRole('heading', { name: reviewHeading })).toBeVisible();
  await expect(page.getByRole('main').locator('img')).toHaveAttribute(
    'src',
    '/applied/figures/private-app-s3/request-path.ja.svg',
  );
  const reveal = page.getByRole('button', { name: '解説を見る' });
  await expect(reveal).toBeDisabled();
  await expect(page.getByRole('heading', { name: '解説', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '対応とその理由を書く' }).fill(response);
  await reveal.click();
  await expect(page.getByRole('heading', { name: '解説', exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText(reviewShown, { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByText(response, { exact: true })).toBeVisible();
  await expect(page.getByText(/^(学習完了|合格|習得済み)$/u)).toHaveCount(0);

  await page.getByRole('link', { name: '応用学習の目次' }).click();
  await page.getByRole('link', { name: '続きから読む', exact: true }).click();
  await expect(page).toHaveURL(slides);
  await expect(page.getByRole('heading', { name: reviewHeading })).toBeVisible();
  await expect(page.getByRole('main').getByText(response, { exact: true })).toBeVisible();
  const storageConsent = page.getByLabel('ゲストの学習記録をこの端末に保存する');
  await storageConsent.uncheck();
  await page.goto(slides);
  await expect(page.getByRole('heading', { name: firstHeading })).toBeVisible();
  await next.click();
  await expect(page.getByRole('heading', { name: secondHeading })).toBeVisible();
  await storageConsent.check();
  await page.goto(`${slides}?step=verify`);
  await expect(page.getByRole('main').getByText(response, { exact: true })).toBeVisible();
});

test('保存に同意していないゲストの閲覧位置を再読み込み後に復元しない', async ({ page }) => {
  await page.goto(slides);
  await allowNecessaryCookies(page);
  await expect(page.getByRole('heading', { name: firstHeading })).toBeVisible();
  await expect(page.getByLabel('ゲストの学習記録をこの端末に保存する')).not.toBeChecked();
  await page.getByRole('button', { name: '次へ', exact: true }).click();
  await expect(page.getByRole('heading', { name: secondHeading })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: firstHeading })).toBeVisible();
});
