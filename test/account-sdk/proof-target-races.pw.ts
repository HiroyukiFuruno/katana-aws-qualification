import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { type TargetRace, verifyTargetProofRace } from '../account-merge/proof-target-races';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import type { IntentKind } from './control-fixture';
import { authenticate } from './flow';
import { observeSdkPage } from './observations';
import { assertProofReports } from './proof-assertions';
import { assertMergeExistingProofs } from './proof-merge-existing';
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

const cases: { kind: TargetRace; intentKind: IntentKind }[] = [
  { kind: 'sourceMembership', intentKind: 'merge_existing' },
  { kind: 'sourceDeadline', intentKind: 'merge_existing' },
  { kind: 'targetMembership', intentKind: 'add_existing' },
  { kind: 'sourceSession', intentKind: 'merge_existing' },
  { kind: 'sourceFreshness', intentKind: 'merge_existing' },
];

for (const item of cases) {
  const slug = item.kind.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  test(`target proof rejects ${item.kind} after a real lower-row wait`, async ({ browser }) => {
    const adapter = await startSdkAdapter({
      intentKind: item.intentKind,
      cleanupReceiptFilename: `sdk-proof-target-${slug}-cleanup.json`,
      beforeProofAccept: (port) =>
        port.side === 'target' ? verifyTargetProofRace(port, item.kind) : Promise.resolve(),
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const observations = observeSdkPage(page, `sdk-proof-target-${slug}-observations.json`);
    try {
      await loginMain(page);
      await page.goto('/test/account-sdk/browser.html');
      await expect(page.getByRole('status')).toHaveText('ready');
      const before = await mainSessionSnapshot(page);
      const jwtExpiry = await mainSessionJwtExpiry(page);
      await authenticate(page, 'source', 'awaiting_target');
      await page.goto('/test/account-sdk/browser.html');
      await expect(page.getByRole('status')).toHaveText('ready');
      expect(await mainSessionSnapshot(page)).toEqual(before);
      expect(await mainSessionJwtExpiry(page)).toBe(jwtExpiry);
      await authenticate(page, 'target', 'both_proved');
      await page.goto('/test/account-sdk/browser.html');
      await expect(page.getByRole('status')).toHaveText('ready');
      expect(await mainSessionSnapshot(page)).toEqual(before);
      expect(await mainSessionJwtExpiry(page)).toBe(jwtExpiry);
      expect(observations.pageErrors).toEqual([]);
      expect(observations.thirdPartyScripts).toEqual([]);
      expect(observations.analyticsRequests).toEqual([]);
      await expect.poll(() => observations.publicBodies.length).toBe(4);
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
      await adapter.assertNoBrowserLeak([
        ...storage.local.map((entry) => JSON.stringify(entry)),
        ...storage.session.map((entry) => JSON.stringify(entry)),
        ...observations.publicBodies,
        ...observations.consoleMessages,
        ...observations.requestUrls,
        page.url(),
      ]);
      const proof = await adapter.proof();
      assertProofReports(proof, before.userId);
      const mergeExisting =
        item.intentKind === 'merge_existing'
          ? assertMergeExistingProofs(proof, before.userId)
          : undefined;
      const postconditions = await adapter.verifyPostAcceptance();
      writeFileSync(
        `${artifacts}/sdk-proof-target-${item.kind}.json`,
        `${JSON.stringify(
          {
            status: 'passed',
            kind: item.kind,
            intentKind: item.intentKind,
            mainSession: before,
            mainJwtExpiry: jwtExpiry,
            proof,
            mergeExisting,
            postconditions,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      try {
        observations.write();
      } finally {
        try {
          await context.close();
        } finally {
          await adapter.close();
        }
      }
    }
  });
}
