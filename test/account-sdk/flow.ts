import { expect, type Page } from '@playwright/test';

function observe<T>(pending: Promise<T>) {
  const settled = pending.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return {
    async unwrap() {
      const result = await settled;
      if (!result.ok) throw result.error;
      return result.value;
    },
  };
}

export async function authenticate(
  page: Page,
  side: 'source' | 'target',
  expectedState: 'awaiting_target' | 'both_proved' | 'already_linked',
  sameSourceProvider = false,
) {
  const started = observe(
    page.waitForResponse(
      (response) =>
        response.url() === 'http://127.0.0.1:54534/start' && response.request().method() === 'POST',
    ),
  );
  await page.getByRole('button', { name: `Authenticate ${side}`, exact: true }).click();
  const response = await started.unwrap();
  expect(response.status()).toBe(200);
  const start: unknown = await response.json();
  if (
    !start ||
    typeof start !== 'object' ||
    !('authorizationUrl' in start) ||
    typeof start.authorizationUrl !== 'string'
  )
    throw new Error('Missing native authorization URL');
  expect(start).toMatchObject({ state: 'issued' });
  expect(new URL(start.authorizationUrl).searchParams.get('redirect_to')).toBe(
    'http://127.0.0.1:54533/test/account-sdk/callback.html',
  );
  await expect(page.getByRole('status')).toHaveText('authorization_ready');
  const exchanged = observe(
    page.waitForResponse(
      (value) =>
        value.url() === 'http://127.0.0.1:54534/exchange' && value.request().method() === 'POST',
    ),
  );
  await page.getByRole('link', { name: 'Continue to provider', exact: true }).click();
  if (side === 'target' && !sameSourceProvider) {
    await page.getByLabel('Username or email').fill('sdk-second');
    await page.getByLabel('Password', { exact: true }).fill('integration-only');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  }
  await expect(page.getByRole('status')).toHaveText(expectedState);
  expect(page.url()).not.toMatch(/[?&](code|error)=/);
  const received = await exchanged.unwrap();
  const value: unknown = await received.json();
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid proof reply');
  return { status: received.status(), reply: value as Record<string, unknown> };
}
