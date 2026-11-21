import { expect, test } from '@playwright/test';
import { type ProofRaceCase, verifyProofRaces } from '../account-merge/proof-races';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { startSdkAdapter } from './server';

async function mainSessionJwtExpiry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const stored = localStorage.getItem('kaq.account-merge-smoke.v1');
    if (!stored) throw new Error('Missing main session storage');
    const value: unknown = JSON.parse(stored);
    if (!value || typeof value !== 'object' || !('access_token' in value))
      throw new Error('Missing main session token');
    const token = (value as { access_token: unknown }).access_token;
    if (typeof token !== 'string') throw new Error('Invalid main session token');
    const payload = token.split('.')[1];
    if (!payload) throw new Error('Invalid main session JWT');
    const decoded = JSON.parse(
      atob(
        payload
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(Math.ceil(payload.length / 4) * 4, '='),
      ),
    ) as { exp?: unknown };
    if (!Number.isSafeInteger(decoded.exp)) throw new Error('Invalid main session JWT expiry');
    return decoded.exp;
  });
}

const sourceCases: Extract<
  ProofRaceCase,
  'cancel' | 'session' | 'creationFreshness' | 'oauthFreshness'
>[] = ['cancel', 'session', 'creationFreshness', 'oauthFreshness'];

for (const race of sourceCases) {
  test(`source proof rejects ${race} after the real HTTP request waits`, async ({ browser }) => {
    const slug = race.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const adapter = await startSdkAdapter({
      cleanupReceiptFilename: `sdk-proof-${slug}-cleanup.json`,
      beforeProofAccept: (port) => verifyProofRaces(port, race),
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginMain(page);
      await page.goto('/test/account-sdk/browser.html');
      await expect(page.getByRole('status')).toHaveText('ready');
      const before = await mainSessionSnapshot(page);
      const jwtExpiry = await mainSessionJwtExpiry(page);
      await page.getByRole('button', { name: 'Authenticate source', exact: true }).click();
      await page.getByRole('link', { name: 'Continue to provider', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('awaiting_target');
      expect(await mainSessionSnapshot(page)).toEqual(before);
      expect(await mainSessionJwtExpiry(page)).toBe(jwtExpiry);
    } finally {
      await context.close();
      await adapter.close();
    }
  });
}
