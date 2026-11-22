import { expect, test } from '@playwright/test';
import { protectedHash } from '../account-sdk/server-snapshot';
import { sql } from './commands';
import { installPublicScopeFixture, removePublicScopeFixture } from './public-scope-components';
import { publicState } from './public-state';
import {
  type GrantActor,
  type GrantFixture,
  grantFixture,
  grantRpc,
  quote,
} from './session-grants-fixture';
import { seedCommittedGrantProofs } from './session-grants-proof-seed';
import { gatewayOrigin, testKey } from './settings';

async function scopeRpc(actor: GrantActor, name: string, body: object, headers: Record<string, string>) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/rpc/fixture_${name}`, {
    method: 'POST',
    headers: {
      apikey: testKey(),
      Authorization: `Bearer ${actor.accessToken}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status, value: (await response.json()) as unknown };
}

test.describe('private public-scope proposal with real OAuth and PostgREST', () => {
  test.describe.configure({ mode: 'serial' });
  let fixture: GrantFixture | undefined;
  const get = () => {
    if (!fixture) throw new Error('Public scope fixture is not initialized');
    return fixture;
  };
  test.beforeAll(async ({ browser }) => {
    installPublicScopeFixture();
    fixture = await grantFixture(browser);
  });
  test.afterAll(async () => {
    try {
      await fixture?.close();
    } finally {
      removePublicScopeFixture();
    }
  });
  test('uses committed proof grants for read/bootstrap and transaction-local writer scope', async () => {
    const [first, second] = get().actors;
    const ids = seedCommittedGrantProofs(first, second);
    for (const [actor, proof] of [
      [first, ids.source],
      [second, ids.target],
    ] as const)
      expect(
        (
          await grantRpc(actor, 'issue_learning_session_grant', {
            p_reason: 'proof',
            p_proof_id: proof,
            p_receipt_id: ids.receipt,
          })
        ).ok,
      ).toBe(true);
    const unboundBootstrap = await scopeRpc(first, 'read_account_bootstrap', {}, {});
    expect(unboundBootstrap).toMatchObject({
      ok: true,
      value: { state: 'ready', account_id: first.userId, membership_epoch: 1 },
    });
    const headers = { 'x-kaq-account-id': first.userId, 'x-kaq-membership-epoch': '1' };
    const read = await scopeRpc(first, 'read_public_learning_scope', {}, headers);
    expect(read).toMatchObject({
      ok: true,
      value: { account_id: first.userId, membership_epoch: 1, generation: 0 },
    });
    const bootstrap = await scopeRpc(first, 'read_account_bootstrap', {}, headers);
    expect(bootstrap).toMatchObject({
      ok: true,
      value: { state: 'ready', account_id: first.userId, membership_epoch: 1 },
    });
    expect(
      (
        await scopeRpc(
          first,
          'read_account_bootstrap',
          {},
          {
            'x-kaq-account-id': second.userId,
            'x-kaq-membership-epoch': '1',
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await scopeRpc(
          first,
          'open_public_learning_scope',
          { p_mode: 'writer', p_generation: 1 },
          headers,
        )
      ).status,
    ).toBe(409);
    const nested = await scopeRpc(
      first,
      'nested_public_learning_scope',
      {
        p_outer: 'reset',
        p_inner: 'writer',
        p_generation: 0,
      },
      headers,
    );
    expect(nested).toMatchObject({
      ok: true,
      value: { outer: { state_mode: 'reset' }, inner: { state_mode: 'reset' } },
    });
    expect(
      await scopeRpc(
        first,
        'nested_public_learning_scope',
        {
          p_outer: 'writer',
          p_inner: 'reset',
          p_generation: 0,
        },
        headers,
      ),
    ).toMatchObject({ ok: false, status: 409 });
    expect(await scopeRpc(first, 'public_learning_scope_cache_probe', {}, headers)).toMatchObject({
      ok: true,
      value: false,
    });
    expect(
      (await scopeRpc(first, 'read_public_learning_scope', {}, { 'x-kaq-account-id': first.userId }))
        .status,
    ).toBe(403);
    const before = { private: protectedHash(), public: publicState() };
    sql(`delete from kaq_private.learning_session_grants where auth_user_id=${quote(second.userId)};
      delete from kaq_private.account_committed_proof_bindings where auth_user_id=${quote(second.userId)};
      delete from kaq_private.learning_memberships where auth_user_id=${quote(second.userId)}`);
    const afterDetach = { private: protectedHash(), public: publicState() };
    expect(await scopeRpc(second, 'read_account_bootstrap', {}, {})).toMatchObject({
      ok: true,
      value: { state: 'onboarding_required' },
    });
    expect(protectedHash()).toBe(afterDetach.private);
    expect(publicState()).toEqual(afterDetach.public);
    expect(before.public).toEqual(afterDetach.public);
  });
});
