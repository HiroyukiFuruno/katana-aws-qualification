import assert from 'node:assert/strict';
import { type Browser, type BrowserContext, expect } from '@playwright/test';
import { protectedHash } from '../account-sdk/server-snapshot';
import { sql } from './commands';
import { publicState } from './public-state';
import { type VerifiedSession, verifySession } from './session-proof';
import { gatewayOrigin, testKey } from './settings';

export type GrantActor = VerifiedSession & { sessionId: string; refresh(): Promise<string> };
export type GrantFixture = { actors: GrantActor[]; close(): Promise<void> };
export const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function grantRpc(actor: GrantActor, name: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/rpc/fixture_${name}`, {
    method: 'POST',
    headers: {
      apikey: testKey(),
      Authorization: `Bearer ${actor.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, ok: response.ok, value: (await response.json()) as unknown };
}

export function grantHash() {
  return sql(`select md5(jsonb_build_object(
    'grants',(select coalesce(jsonb_agg(to_jsonb(r) order by session_id),'[]') from kaq_private.learning_session_grants r),
    'bindings',(select coalesce(jsonb_agg(to_jsonb(r) order by proof_id),'[]') from kaq_private.account_committed_proof_bindings r)
  )::text)`);
}

async function login(
  context: BrowserContext,
  label: string,
  username: string,
  realm: string,
  provider: string,
) {
  const page = await context.newPage();
  await page.goto('/test/account-merge/browser.html');
  await expect(page.getByRole('status')).toHaveText('ready');
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('authenticated');
  const session: VerifiedSession = await page.evaluate(async () => {
    const path = '/test/account-merge/browser.ts';
    return (await import(path)).verifiedSession();
  });
  const proof = verifySession(session, realm, provider);
  return {
    ...session,
    sessionId: proof.sessionId,
    refresh: () =>
      page.evaluate(async () => {
        const path = '/test/account-merge/browser.ts';
        return (await import(path)).refreshVerifiedSession();
      }),
  };
}

export async function grantFixture(browser: Browser): Promise<GrantFixture> {
  assert.equal(
    sql(`select count(*) from auth.users where email in
    ('sdk-first@account-merge.example.test','sdk-second@account-merge.example.test')`),
    '0',
  );
  const before = publicState();
  const beforeGrants = grantHash();
  const beforeProtected = protectedHash();
  const contexts: BrowserContext[] = [];
  const actors: GrantActor[] = [];
  const close = async () => {
    try {
      const owned: string[] = JSON.parse(
        sql(`select coalesce(json_agg(id::text),'[]'::json) from auth.users
        where email in ('sdk-first@account-merge.example.test','sdk-second@account-merge.example.test')`),
      );
      if (owned.length) {
        const ids = owned.map(quote).join(',');
        sql(`delete from kaq_private.learning_session_grants where auth_user_id in (${ids});
          delete from kaq_private.account_committed_proof_bindings where auth_user_id in (${ids});
          delete from kaq_private.account_intents where actor_uid in (${ids});
          delete from kaq_private.learning_memberships where auth_user_id in (${ids});`);
      }
      for (const userId of owned) {
        const uid = quote(userId);
        sql(`delete from public.learning_state where user_id=${uid};
          delete from kaq_private.learning_accounts where id=${uid};`);
        const response = await fetch(`${gatewayOrigin}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            apikey: testKey('service_role'),
            Authorization: `Bearer ${testKey('service_role')}`,
          },
        });
        assert(response.ok, `Owned grant fixture Auth cleanup failed: ${response.status}`);
      }
      assert.deepEqual(publicState(), before, 'Grant fixture changed original public state');
      assert.equal(grantHash(), beforeGrants, 'Grant fixture changed original private grants');
      assert.equal(protectedHash(), beforeProtected, 'Grant fixture changed original Auth/private rows');
      assert.equal(
        sql(`select count(*) from auth.users where email in
        ('sdk-first@account-merge.example.test','sdk-second@account-merge.example.test')`),
        '0',
      );
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  };
  try {
    for (const [label, username, realm, provider] of [
      ['First issuer', 'sdk-first', 'first', 'keycloak'],
      ['Second issuer', 'sdk-second', 'second', 'azure'],
    ]) {
      const context = await browser.newContext();
      contexts.push(context);
      const actor = await login(context, label, username, realm, provider);
      actors.push(actor);
      const uid = quote(actor.userId);
      sql(`insert into kaq_private.learning_accounts(id) values(${uid});
        insert into kaq_private.learning_memberships(auth_user_id,account_id) values(${uid},${uid});
        insert into public.learning_state(user_id) values(${uid});`);
    }
    await expect
      .poll(async () => (await grantRpc(actors[0], 'resolve_current_learning_grant')).status)
      .toBe(401);
    return { actors, close };
  } catch (error) {
    await close();
    throw error;
  }
}
