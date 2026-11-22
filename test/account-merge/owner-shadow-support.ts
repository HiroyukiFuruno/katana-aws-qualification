import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from './commands';
import { artifacts, gatewayOrigin, testKey } from './settings';

export type Issuer = { userId: string; sessionId: string };
export type StateRow = Record<string, unknown> & { user_id: string; generation: number };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export function quoted(value: string) {
  if (!uuid.test(value)) throw new Error('Invalid owner-shadow UUID');
  return `'${value}'::uuid`;
}

export async function admin(method: 'POST' | 'DELETE' | 'GET', email: string, id = '') {
  const response = await fetch(`${gatewayOrigin}/auth/v1/admin/users${id ? `/${id}` : ''}`, {
    method,
    headers: {
      apikey: testKey('service_role'),
      Authorization: `Bearer ${testKey('service_role')}`,
      'Content-Type': 'application/json',
    },
    body: method === 'POST' ? JSON.stringify({ email, email_confirm: true }) : undefined,
  });
  if (method === 'GET') {
    if (response.status === 404) return '';
    if (!response.ok) throw new Error(`Owner shadow Admin API failed (${response.status})`);
    throw new Error('Owner shadow Auth user still exists');
  }
  if (!response.ok) throw new Error(`Owner shadow Admin API failed (${response.status})`);
  if (method === 'DELETE') return '';
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    !('id' in body) ||
    typeof body.id !== 'string' ||
    !uuid.test(body.id)
  )
    throw new Error('Owner shadow Admin API returned an invalid user');
  return body.id;
}

export function ownersFromSmoke(): Issuer[] {
  const smoke: unknown = JSON.parse(readFileSync(`${artifacts}/smoke-proof.json`, 'utf8'));
  if (!smoke || typeof smoke !== 'object' || !('issuers' in smoke) || !Array.isArray(smoke.issuers))
    throw new Error('Missing real OAuth smoke receipt');
  const issuers = smoke.issuers.filter(
    (issuer): issuer is Issuer =>
      !!issuer &&
      typeof issuer === 'object' &&
      'userId' in issuer &&
      'sessionId' in issuer &&
      typeof issuer.userId === 'string' &&
      typeof issuer.sessionId === 'string' &&
      uuid.test(issuer.userId) &&
      uuid.test(issuer.sessionId),
  );
  if (issuers.length !== 2 || new Set(issuers.map((issuer) => issuer.userId)).size !== 2)
    throw new Error('Expected two distinct real OAuth owners');
  return issuers;
}

export function privateRows(ids: string[]) {
  return JSON.parse(
    sql(`select jsonb_build_object(
    'accounts',(select count(*) from kaq_private.learning_accounts where id = any(array[${ids.map(quoted)}])),
    'members',(select count(*) from kaq_private.learning_memberships where auth_user_id = any(array[${ids.map(quoted)}])),
    'grants',(select count(*) from kaq_private.learning_session_grants where auth_user_id = any(array[${ids.map(quoted)}]))
  )`),
  ) as { accounts: number; members: number; grants: number };
}

export function stateRows(): StateRow[] {
  const rows: unknown = JSON.parse(
    sql(`select coalesce(jsonb_agg(to_jsonb(state) order by state.user_id),'[]'::jsonb)
      from public.learning_state state`),
  );
  if (!Array.isArray(rows)) throw new Error('Invalid learning-state snapshot');
  for (const row of rows)
    assert(
      row &&
        typeof row === 'object' &&
        'user_id' in row &&
        'generation' in row &&
        typeof row.user_id === 'string' &&
        typeof row.generation === 'number',
    );
  return rows as StateRow[];
}

export function removeShadowRows(ids: string[]) {
  const values = `array[${ids.map(quoted)}]`;
  sql(`delete from kaq_private.learning_session_grants where auth_user_id = any(${values});
    delete from kaq_private.learning_memberships where auth_user_id = any(${values});
    delete from kaq_private.learning_accounts where id = any(${values});`);
}
