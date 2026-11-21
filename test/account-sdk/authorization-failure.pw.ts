import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { observeSdkPage } from './observations';
import { startSdkAdapter } from './server';

test('native AuthClient persists authorization failure at the current revision', async ({ browser }) => {
  const adapter = await startSdkAdapter({
    authorizationFailure: true,
    cleanupReceiptFilename: 'sdk-authorization-failure-cleanup.json',
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const observations = observeSdkPage(page, 'sdk-authorization-failure-observations.json');
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    const before = await mainSessionSnapshot(page);
    const started = page.waitForResponse(
      (response) =>
        response.url() === 'http://127.0.0.1:54534/start' && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Authenticate source', exact: true }).click();
    const reply = await started;
    expect(reply.status()).toBe(200);
    await expect(page.getByRole('status')).toHaveText('failed');
    const startedBody: unknown = await reply.json();
    expect(await mainSessionSnapshot(page)).toEqual(before);
    expect(page.url()).not.toMatch(/[?&](code|error)=/);
    adapter.assertNoCodeExchange();
    const failure = adapter.verifyAuthorizationFailure();
    const expectedReply = {
      legId: failure.legId,
      expiresAt: failure.expiresAt,
      state: 'failed',
      failure: 'authorization_failed',
    };
    expect(startedBody).toEqual(expectedReply);
    await expect.poll(() => observations.publicBodies.length).toBe(1);
    expect(JSON.parse(observations.publicBodies[0])).toEqual(expectedReply);
    const browserStorage = await page.evaluate(() => [
      JSON.stringify(Object.entries(localStorage)),
      JSON.stringify(Object.entries(sessionStorage)),
    ]);
    adapter.assertAuthorizationFailurePrivacy([
      ...browserStorage,
      ...observations.publicBodies,
      ...observations.consoleMessages,
      ...observations.requestUrls,
      page.url(),
    ]);
    expect(failure).toMatchObject({
      legRevision: 2,
      runtimeRevision: Number.MAX_SAFE_INTEGER,
      nextAttempt: 2,
      nextState: 'issued',
    });
    expect(failure.nextLegId).not.toBe(failure.legId);
    expect(observations.pageErrors).toEqual([]);
    expect(observations.analyticsRequests).toEqual([]);
    expect(observations.thirdPartyScripts).toEqual([]);
    writeFileSync(
      `${artifacts}/sdk-authorization-failure.json`,
      `${JSON.stringify({ status: 'passed', mainSession: before, failure }, null, 2)}\n`,
    );
  } finally {
    observations.write();
    await context.close();
    await adapter.close();
  }
});
