import { readFileSync, writeFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { sql } from './commands';
import type { VerifiedSession } from './session-proof';
import { artifacts, gatewayOrigin, testKey } from './settings';

type FoundationChecks = { status: string; checks: string[] };

function databaseSnapshot() {
  const publicTables: string[] = JSON.parse(
    sql("select json_agg(tablename order by tablename) from pg_tables where schemaname = 'public'"),
  );
  const tables = publicTables.map((table) => {
    if (!/^[a-z_]+$/.test(table)) throw new Error('Unexpected public table identifier');
    return `public.${table}`;
  });
  tables.push('auth.users', 'auth.sessions', 'auth.identities', 'auth.mfa_amr_claims');
  const fingerprints = tables.map(
    (table) => `select '${table}' as relation, count(*) as rows,
      encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),
        '[]'::jsonb)::text, 'sha256'), 'hex') as digest from ${table} row`,
  );
  return sql(`select jsonb_agg(to_jsonb(snapshot) order by relation)
    from (${fingerprints.join(' union all ')}) snapshot`);
}

async function verifyPrivateRest(token: string) {
  const response = await fetch(`${gatewayOrigin}/rest/v1/learning_accounts`, {
    headers: { apikey: testKey(), Authorization: `Bearer ${token}`, 'Accept-Profile': 'kaq_private' },
  });
  expect(response.status).toBe(406);
  const body: { code: string } = await response.json();
  expect(body.code).toBe('PGRST106');
  return { status: response.status, code: body.code };
}

export async function verifyFoundation(
  first: VerifiedSession,
  second: VerifiedSession,
  firstSessionId: string,
  secondSessionId: string,
) {
  const identifiers = [first.userId, second.userId, firstSessionId, secondSessionId];
  for (const identifier of identifiers) {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(identifier)) {
      throw new Error('Invalid foundation fixture identifier');
    }
  }
  const rest = [
    await verifyPrivateRest(testKey()),
    await verifyPrivateRest(first.accessToken),
    await verifyPrivateRest(second.accessToken),
  ];
  const before = databaseSnapshot();
  const statement = readFileSync(new URL('./foundation.sql', import.meta.url), 'utf8')
    .replaceAll('__FIRST_USER__', first.userId)
    .replaceAll('__SECOND_USER__', second.userId)
    .replaceAll('__FIRST_SESSION__', firstSessionId)
    .replaceAll('__SECOND_SESSION__', secondSessionId);
  const output = sql(statement);
  const evidence = output.split('\n').find((line) => line.startsWith('{'));
  if (!evidence) throw new Error('Foundation SQL did not return a verification receipt');
  const checks: FoundationChecks = JSON.parse(evidence);
  expect(checks.status).toBe('passed');
  expect(checks.checks.length).toBeGreaterThan(100);
  expect(databaseSnapshot()).toBe(before);
  const privateTables: string[] = JSON.parse(
    sql("select json_agg(tablename order by tablename) from pg_tables where schemaname = 'kaq_private'"),
  );
  expect(privateTables).toHaveLength(10);
  for (const table of privateTables) {
    if (!/^[a-z_]+$/.test(table)) throw new Error('Unexpected private table identifier');
    expect(sql(`select count(*) from kaq_private.${table}`)).toBe('0');
  }
  const proof = {
    status: 'passed',
    checks: checks.checks,
    privateTables,
    rest,
    transaction: 'rolled_back',
    publicDataUnchanged: true,
    authUsersAndSessionsRestored: true,
    oauthCreatedPrivateAccounts: 0,
  };
  writeFileSync(`${artifacts}/foundation-proof.json`, `${JSON.stringify(proof, null, 2)}\n`);
  return proof;
}
