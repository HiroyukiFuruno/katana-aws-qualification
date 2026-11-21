import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { proofSessionReuseFixture } from '../account-merge/proof-session-reuse';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { authenticate } from './flow';
import { observeSdkPage } from './observations';
import { assertProofReports } from './proof-assertions';
import type { ProofRacePort } from './proof-port';
import { startSdkAdapter } from './server';
import { type Actor, requiredUuid } from './sql';

async function mainActor(page: import('@playwright/test').Page): Promise<Actor> {
  return page.evaluate(() => {
    const stored = localStorage.getItem('kaq.account-merge-smoke.v1');
    if (!stored) throw new Error('Missing main session storage');
    const token = (JSON.parse(stored) as { access_token?: unknown }).access_token;
    if (typeof token !== 'string') throw new Error('Missing main session token');
    const encoded = token.split('.')[1];
    if (!encoded) throw new Error('Invalid main session JWT');
    const claims = JSON.parse(
      atob(
        encoded
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(Math.ceil(encoded.length / 4) * 4, '='),
      ),
    ) as {
      sub?: unknown;
      session_id?: unknown;
      exp?: unknown;
    };
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.session_id !== 'string' ||
      !Number.isSafeInteger(claims.exp)
    )
      throw new Error('Invalid main session claims');
    return { userId: claims.sub, sessionId: claims.session_id, expiresAt: Number(claims.exp) };
  });
}

test('reused real proof session rejects only at the global SID guard', async ({ browser }) => {
  let fixture: ReturnType<typeof proofSessionReuseFixture> | undefined;
  const adapter = await startSdkAdapter({
    cleanupReceiptFilename: 'sdk-proof-session-reuse-cleanup.json',
    beforeProofAccept: (port: ProofRacePort) =>
      port.side === 'source'
        ? (fixture?.beforeProofAccept(port) ?? Promise.resolve())
        : Promise.resolve(),
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const observations = observeSdkPage(page, 'sdk-proof-session-reuse-observations.json');
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    const before = await mainSessionSnapshot(page);
    const actor = await mainActor(page);
    expect(requiredUuid(actor.userId)).toBe(before.userId);
    fixture = proofSessionReuseFixture(actor);
    await authenticate(page, 'source', 'awaiting_target');
    expect(await mainSessionSnapshot(page)).toEqual(before);
    expect((await mainActor(page)).expiresAt).toBe(actor.expiresAt);
    const sourceProof = await adapter.proof();
    expect(sourceProof).toHaveLength(1);
    expect(sourceProof[0]).toMatchObject({ state: 'proved', ingestNonceRemoved: true });
    const reuse = fixture.result();
    fixture.cleanup();
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    await authenticate(page, 'target', 'both_proved');
    expect(await mainSessionSnapshot(page)).toEqual(before);
    expect((await mainActor(page)).expiresAt).toBe(actor.expiresAt);
    expect(observations.pageErrors).toEqual([]);
    expect(observations.thirdPartyScripts).toEqual([]);
    expect(observations.analyticsRequests).toEqual([]);
    await expect.poll(() => observations.publicBodies.length).toBe(4);
    const storage = await page.evaluate(() => [
      ...Object.entries(localStorage),
      ...Object.entries(sessionStorage),
    ]);
    expect(storage.map(([key]) => key).join('\n')).not.toMatch(/kaq-proof|ingest[-_]nonce/i);
    await adapter.assertNoBrowserLeak([
      ...storage.map((entry) => JSON.stringify(entry)),
      ...observations.publicBodies,
      ...observations.consoleMessages,
      ...observations.requestUrls,
      page.url(),
    ]);
    const proof = await adapter.proof();
    assertProofReports(proof, before.userId);
    const postconditions = await adapter.verifyPostAcceptance();
    writeFileSync(
      `${artifacts}/sdk-proof-session-reuse.json`,
      `${JSON.stringify({ status: 'passed', mainSession: before, sourceProof, reuse, proof, postconditions }, null, 2)}\n`,
    );
  } finally {
    try {
      fixture?.cleanup();
      observations.write();
      await context.close();
    } finally {
      await adapter.close();
    }
  }
});
