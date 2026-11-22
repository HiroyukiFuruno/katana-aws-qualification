import { expect, test } from '@playwright/test';
import { messages } from '../../src/messages';
import { createSessions } from './sessions';
import { expectSaved, openSitePreferences } from './site-preferences.helpers';

test('two same-user contexts surface the real CAS conflict and reload before another save', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    const second = await secondContext.newPage();
    await Promise.all([openSitePreferences(first, session), openSitePreferences(second, session)]);

    await first.locator('#account-theme').selectOption('dark');
    await expectSaved(first);
    await second.locator('#account-theme').selectOption('light');
    const alert = second.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(second.locator('#account-theme')).toBeDisabled();
    await alert.getByRole('button', { name: messages.ja.sitePreferencesReload }).click();
    await expect(second.locator('#account-theme')).toHaveValue('dark');
    await expect(second.locator('#account-theme')).toBeEnabled();
    await second.locator('#account-theme').selectOption('light');
    await expectSaved(second);
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});

test('offline member save is held until cloud reload, and another user never receives it', async ({
  browser,
}) => {
  const [firstSession, secondSession] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    await openSitePreferences(first, firstSession);
    await firstContext.setOffline(true);
    await first.locator('#account-theme').selectOption('dark');
    await expect(first.getByRole('alert')).toBeVisible();
    await expect(first.locator('#account-theme')).toBeDisabled();
    await firstContext.setOffline(false);
    await first
      .getByRole('alert')
      .getByRole('button', { name: messages.ja.sitePreferencesReload })
      .click();
    await expect(first.locator('#account-theme')).toHaveValue('system');
    await expect(first.locator('#account-theme')).toBeEnabled();

    const second = await secondContext.newPage();
    await openSitePreferences(second, secondSession);
    await expect(second.locator('#account-theme')).toHaveValue('system');
    await expect(second.locator('#account-default-locale')).toHaveValue('');
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
