import assert from 'node:assert/strict';
import { expect, type Page } from '@playwright/test';
import { sql } from './commands';
import { admin, quoted } from './owner-shadow-support';
import { gatewayOrigin, testKey } from './settings';

export type NativeOwner = { accessToken: string; userId: string };

const ownerTables = [
  'assessment_answers',
  'dashboard_settings',
  'earned_certifications',
  'exam_responses',
  'exam_sessions',
  'fundamentals_final_sessions',
  'fundamentals_unit_progress',
  'learning_events',
  'learning_state',
  'migration_items',
  'migration_manifests',
  'roadmap_profiles',
] as const;

export function literal(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function login(page: Page, label: string, username: string): Promise<NativeOwner> {
  await page.goto('/test/account-merge/browser.html');
  await expect(page.getByRole('status')).toHaveText('ready');
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('integration-only');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('authenticated');
  return page.evaluate(async () => {
    const modulePath = '/test/account-merge/browser.ts';
    return (await import(modulePath)).verifiedSession();
  });
}

export async function rpc(owner: NativeOwner, name: string, body: object): Promise<unknown> {
  const response = await fetch(`${gatewayOrigin}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: testKey(),
      Authorization: `Bearer ${owner.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  expect(response.ok, text).toBe(true);
  return text ? JSON.parse(text) : null;
}

export function unrelatedOwnerRows(ownerIds: string[]) {
  const owners = `array[${ownerIds.map(quoted).join(',')}]`;
  return sql(`select jsonb_build_object(
    ${ownerTables.map((table) => `'${table}', (select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),'[]'::jsonb) from public.${table} row where row.user_id <> all(${owners}))`).join(',\n    ')}
  )::text`);
}

export async function cleanupRealOwners(
  ownerIds: string[],
  receipt: string | null,
  intent: string | null,
) {
  if (receipt || intent) {
    sql(`
      ${receipt ? `delete from kaq_private.account_merge_receipts where id = ${quoted(receipt)};` : ''}
      ${intent ? `delete from kaq_private.account_intents where id = ${quoted(intent)};` : ''}
      delete from kaq_private.learning_session_grants where auth_user_id = any(array[${ownerIds.map(quoted)}]);
      delete from kaq_private.learning_memberships where auth_user_id = any(array[${ownerIds.map(quoted)}]);
      delete from kaq_private.learning_accounts where id = any(array[${ownerIds.map(quoted)}]);
    `);
  }
  for (const ownerId of ownerIds) {
    await admin('DELETE', '', ownerId);
    await admin('GET', '', ownerId);
  }
  const ownershipLeft = sql(`select jsonb_build_object(
    'auth', (select count(*) from auth.users where id = any(array[${ownerIds.map(quoted)}])),
    'private_accounts', (select count(*) from kaq_private.learning_accounts where id = any(array[${ownerIds.map(quoted)}])),
    'private_memberships', (select count(*) from kaq_private.learning_memberships where auth_user_id = any(array[${ownerIds.map(quoted)}])),
    'public_rows', (${ownerTables.map((table) => `(select count(*) from public.${table} where user_id = any(array[${ownerIds.map(quoted)}]))`).join(' + ')})
  )::text`);
  assert.deepEqual(JSON.parse(ownershipLeft), {
    auth: 0,
    private_accounts: 0,
    private_memberships: 0,
    public_rows: 0,
  });
}
