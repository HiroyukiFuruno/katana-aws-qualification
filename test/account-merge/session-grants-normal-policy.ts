import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { sql } from './commands';
import { type GrantFixture, grantHash, grantRpc, quote } from './session-grants-fixture';

export function normalGrantPolicy(getFixture: () => GrantFixture) {
  test('N-POLICY-01 third-party OAuth client SID cannot receive a normal grant', async () => {
    const actor = getFixture().actors[0];
    assert(actor);
    const uid = quote(actor.userId);
    const sid = quote(actor.sessionId);
    const client = quote(randomUUID());
    const before = grantHash();
    const authBefore = sql(`select md5(jsonb_build_object(
      'user',(select to_jsonb(u) from auth.users u where id=${uid}),
      'session',(select to_jsonb(s) from auth.sessions s where id=${sid})
    )::text)`);
    const original = sql(
      `select coalesce(to_jsonb(oauth_client_id),'null'::jsonb)::text from auth.sessions where id=${sid}`,
    );
    try {
      sql(`insert into auth.oauth_clients(id,registration_type,client_type,redirect_uris,grant_types,token_endpoint_auth_method)
        values(${client},'manual','public','https://fixture.invalid/callback','authorization_code','none');
        update auth.sessions set oauth_client_id=${client} where id=${sid}`);
      const result = await grantRpc(actor, 'issue_learning_session_grant', {
        p_reason: 'reauthenticated',
      });
      expect(result.ok).toBe(false);
      expect(grantHash()).toBe(before);
    } finally {
      sql(`update auth.sessions set oauth_client_id=(${quote(original)}::jsonb #>> '{}')::uuid
        where id=${sid}; delete from auth.oauth_clients where id=${client}`);
      expect(grantHash()).toBe(before);
      expect(
        sql(
          `select md5(jsonb_build_object('user',(select to_jsonb(u) from auth.users u where id=${uid}),'session',(select to_jsonb(s) from auth.sessions s where id=${sid}))::text)`,
        ),
      ).toBe(authBefore);
    }
  });

  for (const isolation of ['REPEATABLE READ', 'SERIALIZABLE']) {
    test(`N-POLICY-02 ${isolation} direct-SQL guard rejects before JWT context`, () => {
      const before = grantHash();
      sql(`begin isolation level ${isolation}; do $guard$ begin
        perform kaq_private.issue_learning_session_grant('reauthenticated');
        raise exception 'isolation guard unexpectedly accepted' using errcode='P0001';
      exception when sqlstate 'PT400' then null; end $guard$; rollback;`);
      expect(grantHash()).toBe(before);
    });
  }
}
