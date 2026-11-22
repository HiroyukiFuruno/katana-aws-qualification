import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { artifacts } from '../account-merge/settings';
import { loginMain, mainSessionSnapshot } from './browser-fixture';
import { authenticate } from './flow';
import {
  assertAlreadyLinkedControl,
  assertAlreadyLinkedResult,
  assertTerminalProofDatabase,
  ownershipSnapshot,
  type TerminalProofIdentity,
} from './proof-already-linked';
import { captureCallbackCode, replayExchange } from './proof-replay';
import { startSdkAdapter } from './server';

for (const scenario of [
  {
    name: 'distinct UID',
    sameAuthUser: false,
    targetProvider: 'azure' as const,
    sameSourceProvider: false,
  },
  {
    name: 'same UID',
    sameAuthUser: true,
    targetProvider: 'keycloak' as const,
    sameSourceProvider: true,
  },
]) {
  test(`already linked ${scenario.name} has one terminal no-op receipt`, async ({ browser }) => {
    let beforeTargetOwnership = '';
    let beforeTerminalProof: TerminalProofIdentity[] = [];
    const adapter = await startSdkAdapter({
      intentKind: 'merge_existing',
      targetProvider: scenario.targetProvider,
      targetSameOwner: !scenario.sameAuthUser,
      cleanupReceiptFilename: `sdk-proof-already-linked-${scenario.sameAuthUser ? 'same' : 'distinct'}-cleanup.json`,
      beforeProofAccept: async (port) => {
        if (port.side === 'target') {
          beforeTargetOwnership = ownershipSnapshot(port.intentId);
          const proof = await adapter.proof();
          beforeTerminalProof = proof.map(({ legId, side, authUserId, sessionId }) => ({
            legId,
            side,
            proofAuthUid: authUserId,
            proofSessionId: sessionId,
          }));
        }
      },
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginMain(page);
      await page.goto('/test/account-sdk/browser.html');
      await expect(page.getByRole('status')).toHaveText('ready');
      const main = await mainSessionSnapshot(page);
      await authenticate(page, 'source', 'awaiting_target');
      const callbackCode = captureCallbackCode(page);
      await page.goto('/test/account-sdk/browser.html');
      await authenticate(page, 'target', 'already_linked', scenario.sameSourceProvider);
      expect(beforeTerminalProof).toHaveLength(2);
      expect(beforeTerminalProof[0]?.proofSessionId).not.toBe(beforeTerminalProof[1]?.proofSessionId);
      const target = beforeTerminalProof.find((proof) => proof.side === 'target');
      if (!target) throw new Error('target proof report is missing');
      expect(target.proofAuthUid === main.userId).toBe(scenario.sameAuthUser);
      expect(beforeTargetOwnership).not.toBe('');
      const terminal = adapter.intent();
      expect(ownershipSnapshot(terminal.intent.id)).toBe(beforeTargetOwnership);
      const receipt = assertAlreadyLinkedControl(terminal.actor, terminal.intent, terminal.kind);
      assertAlreadyLinkedResult(terminal.intent.id, scenario.sameAuthUser, receipt);
      await expect(adapter.proof()).rejects.toThrow('terminal');
      assertTerminalProofDatabase(terminal.intent.id, beforeTerminalProof);
      const replay = await replayExchange(page, target.legId, callbackCode());
      expect(replay).toMatchObject({
        status: 200,
        body: { legId: target.legId, state: 'already_linked' },
      });
      assertAlreadyLinkedResult(terminal.intent.id, scenario.sameAuthUser, receipt);
      writeFileSync(
        `${artifacts}/sdk-proof-already-linked-${scenario.sameAuthUser ? 'same' : 'distinct'}.json`,
        `${JSON.stringify({ status: 'passed', sameAuthUser: scenario.sameAuthUser, receipt, proof: beforeTerminalProof }, null, 2)}\n`,
      );
    } finally {
      try {
        await context.close();
      } finally {
        await adapter.close();
      }
    }
  });
}
