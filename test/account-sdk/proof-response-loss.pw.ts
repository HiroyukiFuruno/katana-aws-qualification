import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { observeSdkPage } from './observations';
import { captureCallbackCode, replayExchange } from './proof-replay';
import { startSdkAdapter } from './server';
import { literal, requiredUuid, sql } from './sql';

test('proof acceptance converges after the committed response is lost', async ({ browser }) => {
  const adapter = await startSdkAdapter({
    cleanupReceiptFilename: 'sdk-proof-response-loss-cleanup.json',
    dropProofResponse: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const observations = observeSdkPage(page, 'sdk-proof-response-loss-observations.json');
  const callbackCode = captureCallbackCode(page);
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    const before = await mainSessionSnapshot(page);
    const started = page.waitForResponse(
      (response) => response.url() === 'http://127.0.0.1:54534/start',
    );
    await page.getByRole('button', { name: 'Authenticate source', exact: true }).click();
    const start = (await (await started).json()) as {
      legId?: unknown;
      state?: unknown;
      expiresAt?: unknown;
    };
    if (typeof start.legId !== 'string') throw new Error('missing proof leg');
    const legId = requiredUuid(start.legId);
    if (!Number.isSafeInteger(start.expiresAt)) throw new Error('missing proof deadline');
    expect(start.state).toBe('issued');
    await page.getByRole('link', { name: 'Continue to provider', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('awaiting_target');
    const beforeReplayProof = await adapter.proof();
    expect(beforeReplayProof).toHaveLength(1);
    expect(
      sql(`select bool_and(p.expires_at=i.expires_at) from kaq_private.account_proofs p
        join kaq_private.account_intents i on i.id=p.intent_id where p.leg_id=${literal(legId)}::uuid;`),
    ).toBe('t');
    const replay = await replayExchange(page, legId, callbackCode());
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ legId, state: 'awaiting_target' });
    expect(Object.keys(replay.body as object).sort()).toEqual([
      'expiresAt',
      'intentId',
      'legId',
      'state',
    ]);
    expect(await mainSessionSnapshot(page)).toEqual(before);
    const proof = await adapter.proof();
    expect(proof).toHaveLength(1);
    expect(proof).toEqual(beforeReplayProof);
    expect(proof[0]).toMatchObject({
      legId,
      state: 'proved',
      ingestNonceRemoved: true,
      providerTokensStripped: true,
    });
    expect(
      sql(`select count(*) from kaq_private.account_proofs where leg_id=${literal(legId)}::uuid;`),
    ).toBe('1');
    const browserStorage = await page.evaluate(() => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }));
    expect(
      [...browserStorage.local, ...browserStorage.session].map(([key]) => key).join('\n'),
    ).not.toMatch(/kaq-proof|ingest[-_]nonce/i);
    await adapter.assertNoBrowserLeak(
      [
        ...browserStorage.local.map((entry) => JSON.stringify(entry)),
        ...browserStorage.session.map((entry) => JSON.stringify(entry)),
        ...observations.publicBodies,
        ...observations.consoleMessages,
        ...observations.requestUrls,
        page.url(),
      ],
      1,
    );
    writeFileSync(
      `${artifacts}/sdk-proof-response-loss.json`,
      `${JSON.stringify({ status: 'passed', mainSession: before, replay: replay.body, proof }, null, 2)}\n`,
    );
  } finally {
    observations.write();
    await context.close();
    await adapter.close();
  }
});
