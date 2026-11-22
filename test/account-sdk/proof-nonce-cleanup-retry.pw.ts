import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { nonceCleanupFault } from '../account-merge/proof-nonce-cleanup-fault';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { observeSdkPage } from './observations';
import { captureCallbackCode, replayExchange } from './proof-replay';
import { startSdkAdapter } from './server';
import { literal, requiredUuid, sql } from './sql';

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
    const claims = JSON.parse(
      atob(
        payload
          .replace(/-/g, '+')
          .replace(/_/g, '/')
          .padEnd(Math.ceil(payload.length / 4) * 4, '='),
      ),
    ) as { exp?: unknown };
    if (!Number.isSafeInteger(claims.exp)) throw new Error('Invalid main session JWT expiry');
    return claims.exp;
  });
}

test('replay removes an accepted proof nonce after stored-envelope cleanup recovers', async ({
  browser,
}) => {
  const fault = nonceCleanupFault();
  const adapter = await startSdkAdapter({
    cleanupReceiptFilename: 'sdk-proof-nonce-cleanup-retry-cleanup.json',
    beforeProofAccept: fault.beforeProofAccept,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const observations = observeSdkPage(page, 'sdk-proof-nonce-cleanup-retry-observations.json');
  const callbackCode = captureCallbackCode(page);
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    const before = await mainSessionSnapshot(page);
    const jwtExpiry = await mainSessionJwtExpiry(page);
    const started = page.waitForResponse(
      (response) => response.url() === 'http://127.0.0.1:54534/start',
    );
    await page.getByRole('button', { name: 'Authenticate source', exact: true }).click();
    const startedBody = (await (await started).json()) as { legId?: unknown; state?: unknown };
    if (typeof startedBody.legId !== 'string') throw new Error('Missing proof leg');
    const legId = requiredUuid(startedBody.legId);
    expect(startedBody.state).toBe('issued');
    await page.getByRole('link', { name: 'Continue to provider', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('awaiting_target');
    fault.restore();
    const beforeReplay = await adapter.proof({ allowRetainedNonce: true });
    expect(beforeReplay).toHaveLength(1);
    expect(beforeReplay[0]).toMatchObject({ legId, state: 'proved', ingestNonceRemoved: false });
    expect(
      sql(`select count(*)=1 and bool_and(proof.expires_at=intent.expires_at) from kaq_private.account_proofs proof
        join kaq_private.account_intents intent on intent.id=proof.intent_id where proof.leg_id=${literal(legId)}::uuid`),
    ).toBe('t');
    const replay = await replayExchange(page, legId, callbackCode());
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ legId, state: 'awaiting_target' });
    expect(await mainSessionSnapshot(page)).toEqual(before);
    expect(await mainSessionJwtExpiry(page)).toBe(jwtExpiry);
    const proof = await adapter.proof();
    expect(proof).toHaveLength(1);
    expect(proof[0]).toMatchObject({
      legId,
      state: 'proved',
      expiresAt: beforeReplay[0]?.expiresAt,
      sessionId: beforeReplay[0]?.sessionId,
      ingestNonceRemoved: true,
    });
    expect(
      sql(`select count(*)=1 and bool_and(proof.expires_at=intent.expires_at) from kaq_private.account_proofs proof
        join kaq_private.account_intents intent on intent.id=proof.intent_id where proof.leg_id=${literal(legId)}::uuid`),
    ).toBe('t');
    const storage = await page.evaluate(() => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }));
    expect([...storage.local, ...storage.session].map(([key]) => key).join('\n')).not.toMatch(
      /kaq-proof|ingest[-_]nonce/i,
    );
    expect(observations.publicBodies.join('\n')).not.toMatch(
      /nonce|verifier|provider.*token|access_token|refresh_token/i,
    );
    await adapter.assertNoBrowserLeak(
      [
        ...storage.local.map((entry) => JSON.stringify(entry)),
        ...storage.session.map((entry) => JSON.stringify(entry)),
        ...observations.publicBodies,
        ...observations.consoleMessages,
        ...observations.requestUrls,
        page.url(),
      ],
      1,
    );
    writeFileSync(
      `${artifacts}/sdk-proof-nonce-cleanup-retry.json`,
      `${JSON.stringify({ status: 'passed', mainSession: before, jwtExpiry, replay: replay.body, proof }, null, 2)}\n`,
    );
  } finally {
    fault.restore();
    observations.write();
    await context.close();
    await adapter.close();
  }
});
