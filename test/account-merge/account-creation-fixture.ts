import { expect, type Browser } from '@playwright/test';
import { protectedHash } from '../account-sdk/server-snapshot';
import { sql } from './commands';
import { publicState } from './public-state';
import { verifySession } from './session-proof';
import { gatewayOrigin, testKey } from './settings';

export type CreationActor = { token: string; userId: string; sessionId: string; close(): Promise<void> };
type RpcResult = { ok: boolean; status: number; value: unknown; requestKey: string | null };

export const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function createRpc(
  actor: CreationActor,
  consent: boolean | null = true,
  requestKey: string | null = crypto.randomUUID(),
): Promise<RpcResult> {
  const response = await fetch(`${gatewayOrigin}/rest/v1/rpc/fixture_create_learning_account`, {
    method: 'POST',
    headers: {
      apikey: testKey(),
      Authorization: `Bearer ${actor.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_consent: consent, p_request_key: requestKey }),
  });
  return {
    ok: response.ok,
    status: response.status,
    value: (await response.json()) as unknown,
    requestKey,
  };
}

export function creationSnapshot() {
  // auth.audit_log_entries は生成時刻を持つ監査ログのため、このfixtureの全行不変hashには含めない。
  return { public: publicState(), protected: protectedHash() };
}

export async function openCreationActor(browser: Browser): Promise<CreationActor> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/test/account-merge/browser.html');
    await expect(page.getByRole('status')).toHaveText('ready');
    await page.getByRole('button', { name: 'First issuer', exact: true }).click();
    await page.getByLabel('Username or email').fill('sdk-first');
    await page.getByLabel('Password', { exact: true }).fill('integration-only');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('authenticated');
    const session = await page.evaluate(async () => {
      const path = '/test/account-merge/browser.ts';
      return (await import(path)).verifiedSession();
    });
    return {
      token: session.accessToken,
      userId: session.userId,
      sessionId: verifySession(session, 'first', 'keycloak').sessionId,
      close: () => context.close(),
    };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function removeOwnedActors() {
  const owned: string[] = JSON.parse(
    sql(`select coalesce(json_agg(id::text),'[]'::json) from auth.users
    where email='sdk-first@account-merge.example.test'`),
  );
  for (const userId of owned) {
    const value = quote(userId);
    sql(`delete from kaq_private.learning_session_grants where auth_user_id=${value};
      delete from kaq_private.learning_account_creation_receipts where auth_user_id=${value};
      delete from public.learning_state where user_id=${value};
      delete from kaq_private.learning_memberships where auth_user_id=${value};
      delete from kaq_private.learning_accounts where id=${value};`);
    const response = await fetch(`${gatewayOrigin}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: testKey('service_role'), Authorization: `Bearer ${testKey('service_role')}` },
    });
    expect(response.ok).toBe(true);
  }
}

export async function withCreationActor(browser: Browser, run: (actor: CreationActor) => Promise<void>) {
  expect(sql("select count(*) from auth.users where email='sdk-first@account-merge.example.test'")).toBe(
    '0',
  );
  const before = creationSnapshot();
  let actor: CreationActor | undefined;
  try {
    actor = await openCreationActor(browser);
    await run(actor);
  } finally {
    try {
      await removeOwnedActors();
    } finally {
      try {
        await actor?.close();
      } finally {
        expect(creationSnapshot()).toEqual(before);
        expect(
          sql("select count(*) from auth.users where email='sdk-first@account-merge.example.test'"),
        ).toBe('0');
      }
    }
  }
}
