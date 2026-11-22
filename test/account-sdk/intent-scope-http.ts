import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { artifacts, gatewayOrigin, testKey } from '../account-merge/settings';

let responseSequence = 0;

type Binding = { accountId: string; membershipEpoch: number };
export type ScopeReply = {
  operation?: unknown;
  intent_id?: unknown;
  existing_account_ids?: unknown;
  generations?: unknown;
  membership_count?: unknown;
};

async function scopeRpc(page: Page, name: string, body: Record<string, unknown>, binding?: Binding) {
  const reply = await page.evaluate(
    async ({ gateway, apiKey, name, body, binding }) => {
      const stored = localStorage.getItem('kaq.account-merge-smoke.v1');
      if (!stored) throw new Error('Missing main session storage');
      const value: unknown = JSON.parse(stored);
      if (!value || typeof value !== 'object' || !('access_token' in value))
        throw new Error('Missing main token');
      const token = value.access_token;
      if (typeof token !== 'string') throw new Error('Invalid main token');
      const response = await fetch(`${gateway}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(binding
            ? {
                'x-kaq-account-id': binding.accountId,
                'x-kaq-membership-epoch': String(binding.membershipEpoch),
              }
            : {}),
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as unknown };
    },
    { gateway: gatewayOrigin, apiKey: testKey(), name, body, binding },
  );
  responseSequence += 1;
  // requestのsecret/tokenは記録せず、実際の認証結果だけを障害調査へ残す。
  writeFileSync(
    `${artifacts}/scope-http-${process.pid}-${responseSequence}.json`,
    `${JSON.stringify(reply, null, 2)}\n`,
  );
  return reply;
}

export function lockScope(
  page: Page,
  intentId: string,
  secret: string,
  revision: number,
  binding?: Binding,
) {
  return scopeRpc(
    page,
    'fixture_lock_account_intent_scope',
    {
      p_intent_id: intentId,
      p_intent_secret: secret,
      p_expected_revision: revision,
    },
    binding,
  );
}

export async function readScopeIntentVersion(
  page: Page,
  intentId: string,
  secret: string,
  binding?: Binding,
) {
  const reply = await scopeRpc(
    page,
    'fixture_read_account_intent',
    { p_intent_id: intentId, p_intent_secret: secret },
    binding,
  );
  if (
    reply.status !== 200 ||
    !reply.body ||
    typeof reply.body !== 'object' ||
    !('version' in reply.body) ||
    typeof reply.body.version !== 'number' ||
    !Number.isSafeInteger(reply.body.version)
  )
    throw new Error('Missing signed intent status version');
  return reply.body.version;
}
