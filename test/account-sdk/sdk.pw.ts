import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artifacts } from '../account-merge/settings';
import { observeSdkPage } from './observations';
import { assertProofReports } from './proof-assertions';
import { startSdkAdapter } from './server';

async function loginMain(page: import('@playwright/test').Page) {
  await page.goto('/test/account-merge/browser.html');
  await expect(page.getByRole('status')).toHaveText('ready');
  await page.getByRole('button', { name: 'First issuer', exact: true }).click();
  await page.getByLabel('Username or email').fill('sdk-first');
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('authenticated');
}

async function snapshot(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const modulePath = '/test/account-sdk/browser.ts';
    const module = (await import(modulePath)) as {
      mainSessionSnapshot(): Promise<{ userId: string; storageHash: string }>;
    };
    return module.mainSessionSnapshot();
  });
}

async function authenticate(page: import('@playwright/test').Page, side: 'source' | 'target') {
  const started = page.waitForResponse(
    (response) =>
      response.url() === 'http://127.0.0.1:54534/start' && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: `Authenticate ${side}`, exact: true }).click();
  const response = await started;
  expect(response.status()).toBe(200);
  const startedBody: unknown = await response.json();
  expect(startedBody).toMatchObject({ state: 'issued' });
  expect(startedBody).toHaveProperty('authorizationUrl');
  if (!startedBody || typeof startedBody !== 'object')
    throw new Error('Missing native authorization URL');
  const authorizationUrl = (startedBody as Record<string, unknown>).authorizationUrl;
  if (typeof authorizationUrl !== 'string') throw new Error('Missing native authorization URL');
  expect(new URL(authorizationUrl).searchParams.get('redirect_to')).toBe(
    'http://127.0.0.1:54533/test/account-sdk/callback.html',
  );
  await expect(page.getByRole('status')).toHaveText('authorization_ready');
  await page.getByRole('link', { name: 'Continue to provider', exact: true }).click();
  if (side === 'target') {
    await page.getByLabel('Username or email').fill('sdk-second');
    await page.getByLabel('Password', { exact: true }).fill('integration-only');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  }
  await expect(page.getByRole('status')).toHaveText('exchanged');
  expect(page.url()).not.toMatch(/[?&](code|error)=/);
}

test('native AuthClient keeps the main session and restores two sealed real-OIDC proof legs', async ({
  browser,
}) => {
  const adapter = await startSdkAdapter();
  const context = await browser.newContext();
  const page = await context.newPage();
  const observations = observeSdkPage(page);
  const { publicBodies, consoleMessages } = observations;
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    const before = await snapshot(page);
    await authenticate(page, 'source');
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    expect(await snapshot(page)).toEqual(before);
    await authenticate(page, 'target');
    await page.goto('/test/account-sdk/browser.html');
    expect(await snapshot(page)).toEqual(before);
    expect(observations.pageErrors).toEqual([]);
    expect(observations.thirdPartyScripts).toEqual([]);
    expect(observations.analyticsRequests).toEqual([]);
    await expect.poll(() => publicBodies.length).toBe(4);
    const storage = await page.evaluate(() => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }));
    expect([...storage.local, ...storage.session].map(([key]) => key).join('\n')).not.toMatch(
      /kaq-proof|ingest[-_]nonce/i,
    );
    expect(publicBodies.join('\n')).not.toMatch(
      /nonce|verifier|provider.*token|access_token|refresh_token/i,
    );
    expect(consoleMessages.join('\n')).not.toMatch(/code=|nonce|verifier|provider.*token/i);
    for (const body of publicBodies) {
      const reply = JSON.parse(body) as Record<string, unknown>;
      expect(Object.keys(reply).sort()).toEqual(
        typeof reply.authorizationUrl === 'string'
          ? ['authorizationUrl', 'expiresAt', 'legId', 'state']
          : ['expiresAt', 'legId', 'state'],
      );
    }
    await adapter.assertNoBrowserLeak([
      ...storage.local.map((entry) => JSON.stringify(entry)),
      ...storage.session.map((entry) => JSON.stringify(entry)),
      ...publicBodies,
      ...consoleMessages,
      ...observations.requestUrls,
      page.url(),
    ]);
    const proof = await adapter.proof();
    assertProofReports(proof, before.userId);
    writeFileSync(
      `${artifacts}/sdk-proof.json`,
      `${JSON.stringify({ status: 'passed', mainSession: before, proof }, null, 2)}\n`,
    );
  } finally {
    observations.write();
    await context.close();
    await adapter.close();
  }
});
