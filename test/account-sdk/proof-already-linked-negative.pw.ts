import { expect, test } from '@playwright/test';
import { loginMain } from './browser-fixture';
import { authenticate } from './flow';
import { FixtureProofError } from './proof-acceptance';
import { startSdkAdapter } from './server';
import { literal, requiredUuid, sql } from './sql';

test('a revoked source owner stays a retryable proof rejection', async ({ browser }) => {
  let rejection: FixtureProofError | undefined;
  let targetSessionId = '';
  const adapter = await startSdkAdapter({
    intentKind: 'merge_existing',
    targetProvider: 'keycloak',
    cleanupReceiptFilename: 'sdk-proof-already-linked-auth-only-cleanup.json',
    beforeProofAccept: async (port) => {
      if (port.side !== 'target') return;
      const current = adapter.intent();
      expect(port.proofAuthUid).toBe(current.actor.userId);
      expect(port.proofSessionId).not.toBe(current.actor.sessionId);
      targetSessionId = port.proofSessionId;
      sql(`delete from kaq_private.learning_session_grants where auth_user_id=${literal(current.actor.userId)}::uuid;
           delete from kaq_private.learning_memberships where auth_user_id=${literal(current.actor.userId)}::uuid;`);
      try {
        await port.accept();
      } catch (error) {
        if (error instanceof FixtureProofError) rejection = error;
        else throw error;
      }
    },
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    await page.getByRole('button', { name: 'Authenticate source', exact: true }).click();
    await page.getByRole('link', { name: 'Continue to provider', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('awaiting_target');
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    const started = page.waitForResponse(
      (response) =>
        response.url() === 'http://127.0.0.1:54534/start' && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Authenticate target', exact: true }).click();
    await started;
    await page.getByRole('link', { name: 'Continue to provider', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('awaiting_target');
    expect(rejection).toMatchObject({ status: 401, code: 'PT401' });
    expect(rejection?.message).toBe('KAQ_PROOF_REAUTHENTICATION_REQUIRED');
    const { intent } = adapter.intent();
    const proof = await adapter.proof();
    expect(proof).toHaveLength(2);
    expect(proof.find((entry) => entry.side === 'source')?.state).toBe('proved');
    expect(proof.find((entry) => entry.side === 'target')?.state).toBe('exchanged');
    expect(proof.find((entry) => entry.side === 'source')?.sessionId).not.toBe(targetSessionId);
    const receipt =
      sql(`select json_build_object('state',state,'proofs',(select count(*) from kaq_private.account_proofs
      where intent_id=intent.id),'receipts',(select count(*) from kaq_private.account_merge_receipts
      where intent_id=intent.id))::text from kaq_private.account_intents intent
      where id=${literal(requiredUuid(intent.id))}::uuid;`);
    expect(JSON.parse(receipt)).toEqual({ state: 'awaiting_target', proofs: 1, receipts: 0 });
  } finally {
    try {
      await context.close();
    } finally {
      await adapter.close();
    }
  }
});

test('auth-only same UID with distinct proof SID rejects before terminal no-op', async ({ browser }) => {
  let rejection: FixtureProofError | undefined;
  const adapter = await startSdkAdapter({
    intentKind: 'add_existing',
    targetProvider: 'keycloak',
    cleanupReceiptFilename: 'sdk-proof-auth-only-same-uid-cleanup.json',
    beforeProofAccept: async (port) => {
      if (port.side !== 'target') return;
      expect(port.proofAuthUid).toBe(adapter.intent().actor.userId);
      expect(port.proofSessionId).not.toBe(adapter.intent().actor.sessionId);
      try {
        await port.accept();
      } catch (error) {
        if (error instanceof FixtureProofError) rejection = error;
        else throw error;
      }
    },
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loginMain(page);
    await page.goto('/test/account-sdk/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    await authenticate(page, 'source', 'awaiting_target');
    await page.goto('/test/account-sdk/browser.html');
    await authenticate(page, 'target', 'awaiting_target', true);
    expect(rejection).toMatchObject({ status: 409, code: 'PT409' });
    expect(rejection?.message).toBe('KAQ_PROOF_SAME_AUTH_USER');
    const { intent } = adapter.intent();
    const proof = await adapter.proof();
    expect(proof).toHaveLength(2);
    expect(proof.find((entry) => entry.side === 'source')?.state).toBe('proved');
    expect(proof.find((entry) => entry.side === 'target')?.state).toBe('exchanged');
    const receipt = sql(`select json_build_object('state',state,'proofs',
      (select count(*) from kaq_private.account_proofs where intent_id=intent.id),
      'receipts',(select count(*) from kaq_private.account_merge_receipts where intent_id=intent.id))::text
      from kaq_private.account_intents intent where id=${literal(requiredUuid(intent.id))}::uuid;`);
    expect(JSON.parse(receipt)).toEqual({ state: 'awaiting_target', proofs: 1, receipts: 0 });
  } finally {
    try {
      await context.close();
    } finally {
      await adapter.close();
    }
  }
});
