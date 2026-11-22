import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from './commands';
import { type Issuer, privateRows, quoted, removeShadowRows } from './owner-shadow-support';
import { publicState } from './public-state';

type Mutation = { label: string; mutate: string; restore: string; grants?: number; error?: string };
const temporal = (value: string | null) =>
  value === null ? 'null' : `'${value.replaceAll("'", "''")}'::timestamptz`;
const uuid = (value: string | null) =>
  value === null ? 'null' : `'${value.replaceAll("'", "''")}'::uuid`;

function value(column: string, table: string, where: string) {
  return JSON.parse(
    sql(`select coalesce(to_jsonb(${column}),'null'::jsonb)::text from ${table} where ${where}`),
  ) as string | null;
}

function oauthClientsHash() {
  return sql(`select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(client)
    order by to_jsonb(client)::text),'[]'::jsonb)::text,'sha256'),'hex') from auth.oauth_clients client`);
}

function authHash() {
  return sql(`select encode(extensions.digest(jsonb_build_object(
    'users',(select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),'[]'::jsonb) from auth.users row),
    'sessions',(select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),'[]'::jsonb) from auth.sessions row),
    'amr',(select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),'[]'::jsonb) from auth.mfa_amr_claims row),
    'clients',(select coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),'[]'::jsonb) from auth.oauth_clients row)
  )::text,'sha256'),'hex')`);
}

export function verifyLiveLegacyBranches(
  apply: () => void,
  ownerIds: string[],
  settingsId: string,
  issuer: Issuer,
) {
  const session = quoted(issuer.sessionId);
  const owner = quoted(issuer.userId);
  const notAfter = value('not_after', 'auth.sessions', `id=${session}`);
  const createdAt = value('created_at', 'auth.sessions', `id=${session}`);
  const client = value('oauth_client_id', 'auth.sessions', `id=${session}`);
  const banned = value('banned_until', 'auth.users', `id=${owner}`);
  const deleted = value('deleted_at', 'auth.users', `id=${owner}`);
  const syntheticClient = quoted(randomUUID());
  const clientsBefore = oauthClientsHash();
  const authBefore = authHash();
  assert.equal(sql(`select count(*) from auth.mfa_amr_claims where session_id=${session}`), '1');
  const cases: Mutation[] = [
    {
      label: 'expired session',
      mutate: `update auth.sessions set not_after=clock_timestamp()-interval '1 minute' where id=${session}`,
      restore: `update auth.sessions set not_after=${temporal(notAfter)} where id=${session}`,
      grants: 1,
    },
    {
      label: 'finite future expiry',
      mutate: `update auth.sessions set not_after=clock_timestamp()+interval '1 hour' where id=${session}`,
      restore: `update auth.sessions set not_after=${temporal(notAfter)} where id=${session}`,
      grants: 2,
    },
    {
      label: 'banned owner',
      mutate: `update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=${owner}`,
      restore: `update auth.users set banned_until=${temporal(banned)} where id=${owner}`,
      error: 'KAQ_OWNER_SHADOW_AUTH_INVALID',
    },
    {
      label: 'deleted owner',
      mutate: `update auth.users set deleted_at=clock_timestamp() where id=${owner}`,
      restore: `update auth.users set deleted_at=${temporal(deleted)} where id=${owner}`,
      error: 'KAQ_OWNER_SHADOW_AUTH_INVALID',
    },
    {
      label: 'non-OAuth AMR',
      mutate: `update auth.mfa_amr_claims set authentication_method='password' where session_id=${session}`,
      restore: `update auth.mfa_amr_claims set authentication_method='oauth' where session_id=${session}`,
      grants: 1,
    },
    {
      label: 'OAuth client session',
      mutate: `insert into auth.oauth_clients(id,registration_type,client_type,redirect_uris,grant_types,token_endpoint_auth_method)
        values(${syntheticClient},'manual','public','https://fixture.invalid/callback','authorization_code','none');
        update auth.sessions set oauth_client_id=${syntheticClient} where id=${session}`,
      restore: `update auth.sessions set oauth_client_id=${uuid(client)} where id=${session};
        delete from auth.oauth_clients where id=${syntheticClient}`,
      grants: 1,
    },
    {
      label: 'future session creation',
      mutate: `update auth.sessions set created_at=clock_timestamp()+interval '6 seconds' where id=${session}`,
      restore: `update auth.sessions set created_at=${temporal(createdAt)} where id=${session}`,
      grants: 1,
    },
  ];
  const before = publicState();
  for (const test of cases) {
    sql(test.mutate);
    try {
      if (test.error) {
        assert.throws(() => apply(), new RegExp(`PT400.*${test.error}`, 's'));
        assert.deepEqual(privateRows(ownerIds), { accounts: 0, members: 0, grants: 0 });
      } else {
        apply();
        assert.deepEqual(privateRows(ownerIds), { accounts: 4, members: 4, grants: test.grants });
      }
    } finally {
      removeShadowRows(ownerIds);
      sql(`delete from public.learning_state where user_id=${quoted(settingsId)}; ${test.restore}`);
    }
    assert.deepEqual(publicState(), before, `${test.label} cleanup changed public state`);
    assert.equal(authHash(), authBefore, `${test.label} changed Auth rows`);
    assert.equal(oauthClientsHash(), clientsBefore, `${test.label} left an OAuth client row`);
  }
}
