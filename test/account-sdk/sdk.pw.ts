import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { authenticate } from './flow';
import { observeSdkPage } from './observations';
import { assertProofReports } from './proof-assertions';
import { startSdkAdapter } from './server';

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
    const before = await mainSessionSnapshot(page);
    await authenticate(page, 'source', 'awaiting_target');
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    expect(await mainSessionSnapshot(page)).toEqual(before);
    await authenticate(page, 'target', 'both_proved');
    await page.goto('/test/account-sdk/browser.html');
    expect(await mainSessionSnapshot(page)).toEqual(before);
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
          : ['expiresAt', 'intentId', 'legId', 'state'],
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
    const postconditions = await adapter.verifyPostAcceptance();
    writeFileSync(
      `${artifacts}/sdk-proof.json`,
      `${JSON.stringify({ status: 'passed', mainSession: before, proof, postconditions }, null, 2)}\n`,
    );
  } finally {
    observations.write();
    await context.close();
    await adapter.close();
  }
});
