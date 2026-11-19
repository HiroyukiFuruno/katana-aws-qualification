import { expect, test } from '@playwright/test';

test('landing explains its concept and value before presenting learning tools', async ({ page }) => {
  await page.goto('/ja/');
  const concept = page.locator('.landing-concept');
  const values = page.locator('.landing-values');
  const paths = page.locator('.landing-paths');
  await expect(values).toBeVisible();
  await expect(paths).toBeVisible();
  const boxes = await Promise.all([concept, values, paths].map((item) => item.boundingBox()));
  for (const box of boxes) expect(box).not.toBeNull();
  expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height + 24);
  expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height + 24);
  await expect(page.locator('.landing-hero a')).toHaveAttribute('href', '#landing-concept-title');
  await expect(page.locator('.landing-values article')).toHaveCount(3);
  const registration = page.getByRole('link', { name: '無料アカウントを作成', exact: true });
  await expect(registration).toBeVisible();
  await expect(registration).toHaveAttribute('href', '/ja/login/');
  const registrationBox = await registration.boundingBox();
  expect(registrationBox!.y).toBeGreaterThan(boxes[1]!.y + boxes[1]!.height);
});

test('landing uses visible typographic emphasis and keeps account details secondary', async ({
  page,
}) => {
  await page.goto('/ja/');
  const emphasis = page.locator('.landing-hero h1 em');
  await expect(emphasis).toHaveText('気楽');
  const styles = await emphasis.evaluate((element) => ({
    color: getComputedStyle(element).color,
    headingColor: getComputedStyle(element.closest('h1')!).color,
    headingSize: Number.parseFloat(getComputedStyle(element.closest('h1')!).fontSize),
    bodySize: Number.parseFloat(getComputedStyle(document.body).fontSize),
  }));
  expect(styles.color).not.toBe(styles.headingColor);
  expect(styles.headingSize).toBeGreaterThan(styles.bodySize * 2);
  const account = page.locator('.landing-account');
  await expect(account).not.toHaveAttribute('open', '');
  await account.locator('summary').click();
  await expect(account.locator('.account-benefits')).toBeVisible();
});

test('editorial landing stays readable on desktop, mobile and dark backgrounds', async ({
  page,
}, info) => {
  for (const [width, colorScheme] of [
    [1440, 'light'],
    [390, 'light'],
    [1280, 'dark'],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/ja/');
    const consent = page.getByRole('button', { name: '必要なもののみ', exact: true });
    if (await consent.isVisible()) await consent.click();
    await expect(page.locator('.landing-values')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`lp-${width}-${colorScheme}.png`), fullPage: true });
  }
});

test('expanded account information remains within mobile and desktop bounds', async ({ page }) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/ja/');
    const account = page.locator('.landing-account');
    await account.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(account.locator('.account-benefits')).toBeVisible();
    const box = await account.locator('.account-benefits').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
