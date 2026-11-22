import { expect, type Page, test } from '@playwright/test';

const consentLabel = 'ゲストの学習記録をこの端末に保存する';
const profileKey = 'katana.certification-profile.v1';
const consentKey = 'katana.learning-progress-consent.v1';
const storedProfile = JSON.stringify({ earned: ['saa-c03'], answers: {} });
const pendingProfile = JSON.stringify({ earned: ['dva-c03'], answers: {}, optionOrders: {}, order: [] });

async function seedStoredProfile(page: Page) {
  await page.goto('/ja/assessment/');
  await page.evaluate(
    ({ key, value, consent }) => {
      localStorage.setItem(key, value);
      localStorage.removeItem(consent);
    },
    { key: profileKey, value: storedProfile, consent: consentKey },
  );
  await page.reload();
}

async function createPendingProfile(page: Page) {
  const dva = page.locator('.earned-directory label').filter({ hasText: 'DVA-C03' });
  await dva.locator('input').check();
  await expect(dva.locator('input')).toBeChecked();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), profileKey))
    .toBe(storedProfile);
  await page.getByLabel(consentLabel).check();
  await expect(page.getByRole('heading', { name: '保存データの競合を解決してください' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(profileKey);
}

test('guest settings can replace a conflicting saved profile with current data', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await seedStoredProfile(page);
    await createPendingProfile(page);
    await page.getByRole('button', { name: '現在の内容で置き換える' }).click();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), profileKey))
      .toBe(pendingProfile);
    await expect(page.getByRole('heading', { name: '保存データの競合を解決してください' })).toHaveCount(
      0,
    );
    await page.reload();
    await expect(
      page.locator('.earned-directory label').filter({ hasText: 'DVA-C03' }).locator('input'),
    ).toBeChecked();
    await expect(
      page.locator('.earned-directory label').filter({ hasText: 'SAA-C03' }).locator('input'),
    ).not.toBeChecked();
  } finally {
    await context.close();
  }
});

test('guest settings can discard current data and keep the saved profile', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await seedStoredProfile(page);
    await createPendingProfile(page);
    await page.getByRole('button', { name: '保存済みを使う' }).click();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), profileKey))
      .toBe(storedProfile);
    await expect(page.getByRole('heading', { name: '保存データの競合を解決してください' })).toHaveCount(
      0,
    );
    await page.reload();
    await expect(
      page.locator('.earned-directory label').filter({ hasText: 'SAA-C03' }).locator('input'),
    ).toBeChecked();
    await expect(
      page.locator('.earned-directory label').filter({ hasText: 'DVA-C03' }).locator('input'),
    ).not.toBeChecked();
  } finally {
    await context.close();
  }
});
