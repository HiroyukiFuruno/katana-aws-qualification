import { expect, test } from '@playwright/test';
import { verifyHttpProofBoundary } from '../account-merge/proof-http-boundary';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { authenticate } from './flow';
import { observeSdkPage } from './observations';
import type { ProofBoundaryKind } from './proof-token-negative';
import { startSdkAdapter } from './server';

for (const kind of ['signature', 'audience', 'issuer', 'nonce'] satisfies ProofBoundaryKind[]) {
  test(`real HTTP rejects ${kind} proof without mutation before valid acceptance`, async ({
    browser,
  }) => {
    const adapter = await startSdkAdapter({
      cleanupReceiptFilename: `sdk-proof-http-${kind}-cleanup.json`,
      beforeProofAccept: (port) => verifyHttpProofBoundary(port, kind),
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const observations = observeSdkPage(page, `sdk-proof-http-${kind}-observations.json`);
    try {
      await loginMain(page);
      await page.goto('/test/account-sdk/browser.html');
      await expect(page.getByRole('status')).toHaveText('ready');
      const before = await mainSessionSnapshot(page);
      const response = await authenticate(page, 'source', 'awaiting_target');
      expect(response.status).toBe(200);
      expect(response.reply.failure).toBeUndefined();
      expect(await mainSessionSnapshot(page)).toEqual(before);
      const stored = await page.evaluate(() =>
        JSON.stringify({ local: Object.entries(localStorage), session: Object.entries(sessionStorage) }),
      );
      await adapter.assertNoBrowserLeak(
        [
          stored,
          ...observations.publicBodies,
          ...observations.consoleMessages,
          ...observations.requestUrls,
        ],
        1,
      );
    } finally {
      observations.write();
      await context.close();
      await adapter.close();
    }
  });
}
