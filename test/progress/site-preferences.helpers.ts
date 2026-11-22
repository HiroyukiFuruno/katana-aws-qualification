import { expect, type Page } from '@playwright/test';
import type { RealSession } from './sessions';
import { setRealSession } from './sessions';

export const appearance = '[aria-labelledby="account-appearance-title"]';

export async function openSitePreferences(page: Page, session: RealSession) {
  await page.goto('/ja/account/settings/');
  await setRealSession(page, session);
  await page.reload();
  await expect(page.locator('#account-default-locale')).toBeEnabled();
  await expect(page.locator('#account-theme')).toBeEnabled();
}

export async function expectSaved(page: Page) {
  await expect(page.locator(appearance).getByRole('status')).toBeVisible();
  await expect(page.locator('#account-theme')).toBeEnabled();
}

export async function expectTheme(page: Page, theme: 'light' | 'dark') {
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
}
