import { expect } from '@playwright/test';

export async function loginMain(page: import('@playwright/test').Page) {
  await page.goto('/test/account-merge/browser.html');
  await expect(page.getByRole('status')).toHaveText('ready');
  await page.getByRole('button', { name: 'First issuer', exact: true }).click();
  await page.getByLabel('Username or email').fill('sdk-first');
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('authenticated');
}

export async function mainSessionSnapshot(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const modulePath = '/test/account-sdk/browser.ts';
    const module = (await import(modulePath)) as {
      mainSessionSnapshot(): Promise<{ userId: string; storageHash: string }>;
    };
    return module.mainSessionSnapshot();
  });
}
