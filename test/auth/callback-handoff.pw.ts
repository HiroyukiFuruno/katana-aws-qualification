import { expect, test } from '@playwright/test';
import { authorizationUrl } from './helpers';

test('a callback opened in another browser explains the PKCE boundary and starts a fresh flow', async ({
  page,
  browser,
}) => {
  await page.goto('/ja/login/');
  const authorization = await authorizationUrl(page);

  const callbackContext = await browser.newContext({ javaScriptEnabled: false });
  const callbackPage = await callbackContext.newPage();
  await callbackPage.goto(authorization);
  await callbackPage.getByLabel('Username or email').fill('learner');
  await callbackPage.getByLabel('Password', { exact: true }).fill('integration-only');
  await callbackPage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(callbackPage).toHaveURL(/\/ja\/auth\/callback\/\?code=/);
  const callbackUrl = callbackPage.url();
  await callbackContext.close();

  const returningContext = await browser.newContext();
  const returningPage = await returningContext.newPage();
  await returningPage.goto(callbackUrl);
  await expect(returningPage).toHaveURL(/\/ja\/auth\/callback\/$/);
  await expect(returningPage.locator('[data-auth-failure="browser"]')).toBeVisible();
  await expect(returningPage.getByRole('button', { name: 'GitHubでログイン' })).toBeVisible();

  await returningPage.goto(await authorizationUrl(returningPage));
  await returningPage.getByLabel('Username or email').fill('learner');
  await returningPage.getByLabel('Password', { exact: true }).fill('integration-only');
  await returningPage.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(returningPage).toHaveURL(/\/ja\/dashboard\/$/);
  await expect(returningPage.getByRole('heading', { name: 'アカウント設定' })).toBeVisible();
  await returningContext.close();
});
