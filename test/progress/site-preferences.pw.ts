import { expect, test } from '@playwright/test';
import { localePath, locales } from '../../src/locales';
import { messages } from '../../src/messages';
import { profileRows } from './api';
import { createSessions, setRealSession } from './sessions';
import { expectSaved, expectTheme, openSitePreferences } from './site-preferences.helpers';

test('member display preferences acknowledge defaults and persist without changing explicit public URLs', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    await openSitePreferences(first, session);
    await expect(first.locator('#account-default-locale option')).toHaveCount(11);
    await first.getByRole('button', { name: messages.ja.sitePreferencesReset }).click();
    await expectSaved(first);
    await expect(first.locator('#account-default-locale')).toHaveValue('');

    await first.locator('#account-default-locale').selectOption('en');
    await expectSaved(first);
    await first.locator('#account-theme').selectOption('dark');
    await expectSaved(first);
    await expectTheme(first, 'dark');

    const second = await secondContext.newPage();
    await openSitePreferences(second, session);
    await expect(second.locator('#account-default-locale')).toHaveValue('en');
    await expect(second.locator('#account-theme')).toHaveValue('dark');

    await first.goto('/ja/dashboard/');
    await expect.poll(() => new URL(first.url()).pathname).toBe('/dashboard/');
    await expect(first.locator('html')).toHaveAttribute('lang', 'en');
    await first.goto('/ja/study/questions/');
    await expect(first).toHaveURL(/\/ja\/study\/questions\/$/);
    await expect(first.locator('html')).toHaveAttribute('lang', 'ja');
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});

for (const locale of locales) {
  test(`${locale} display settings remain keyboard reachable in both themes at mobile width`, async ({
    browser,
  }) => {
    const [session] = await createSessions();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      await openSitePreferences(page, session);
      await page.goto(localePath(locale, 'account/settings'));
      await expect(page.locator('#account-theme')).toBeEnabled();
      for (const theme of ['light', 'dark'] as const) {
        await page.locator('#account-theme').selectOption(theme);
        await expectSaved(page);
        await expectTheme(page, theme);
        await page.locator('#account-default-locale').focus();
        await page.keyboard.press('Tab');
        await expect(page.locator('#account-theme')).toBeFocused();
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(390);
      }
    } finally {
      await context.close();
    }
  });
}

test('guest theme stays local through member sign-in and logout, while earned profile is summarized', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/ja/');
    if ((await page.locator('html').getAttribute('data-theme')) !== 'dark')
      await page.getByRole('button', { name: messages.ja.darkMode, exact: true }).click();
    await expectTheme(page, 'dark');

    await openSitePreferences(page, session);
    await expect(page.locator('#account-theme')).toHaveValue('system');
    await page.goto('/ja/assessment/');
    await setRealSession(page, session);
    await page.reload();
    const certification = page.locator('.earned-directory input[type="checkbox"]').first();
    if (!(await certification.isChecked())) await certification.click();
    await expect.poll(() => profileRows(session).then((rows) => rows.length)).toBe(1);

    await openSitePreferences(page, session);
    await expect(page.locator('main a[href="/ja/assessment/"]')).toBeVisible();
    await expect(
      page.locator('main a[href="/ja/assessment/"]').locator('..').locator('li'),
    ).not.toHaveCount(0);
    await page.getByRole('button', { name: messages.ja.accountSignOut }).click();
    await expectTheme(page, 'dark');
  } finally {
    await context.close();
  }
});
