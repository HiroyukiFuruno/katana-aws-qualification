import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dashboardDefaults } from '../../src/dashboard/preferences';
import { sql } from './commands';
import { verifyOwnerShadowAuthNowait } from './owner-shadow-auth-lock';
import { verifyLiveLegacyBranches } from './owner-shadow-live-negatives';
import { verifyMissingAuthRollback, verifyPrivateConflictRollbacks } from './owner-shadow-negatives';
import {
  admin,
  ownersFromSmoke,
  privateRows,
  quoted,
  removeShadowRows,
  stateRows,
} from './owner-shadow-support';
import { publicState } from './public-state';
import { seedPublicData } from './seed-public';
import { artifacts } from './settings';

export async function verifyOwnerShadowMigration(apply: () => void) {
  const publicBefore = publicState();
  const issuers = ownersFromSmoke();
  const seeded = await seedPublicData();
  const settingsId = await admin('POST', `shadow-settings-${randomUUID()}@example.test`);
  const authOnlyId = await admin('POST', `shadow-auth-only-${randomUUID()}@example.test`);
  const ownerIds = [...issuers.map((issuer) => issuer.userId), seeded.userId, settingsId];
  const session = quoted(issuers[1].sessionId);
  const originalNotAfter = JSON.parse(
    sql(`select coalesce(to_jsonb(not_after),'null'::jsonb)::text
    from auth.sessions where id=${session}`),
  ) as string | null;
  try {
    const settings = JSON.stringify(dashboardDefaults('UTC')).replaceAll("'", "''");
    sql(
      `insert into public.dashboard_settings(user_id,settings) values(${quoted(settingsId)},'${settings}'::jsonb)`,
    );
    const missingAuth = verifyMissingAuthRollback();
    verifyPrivateConflictRollbacks(apply, issuers[0].userId);
    const before = publicState();
    const states = stateRows();
    assert.equal(
      sql(`select count(*) from auth.sessions where user_id=${quoted(authOnlyId)}`),
      '0',
      'Auth-only owner unexpectedly has a session',
    );
    verifyLiveLegacyBranches(apply, ownerIds, settingsId, issuers[1]);
    const authLock = await verifyOwnerShadowAuthNowait(apply, ownerIds, issuers[0], settingsId);
    sql(`update auth.sessions set not_after=null where id=${session}`);
    apply();
    const after = publicState();
    assert.equal(after.schemaDigest, before.schemaDigest, 'Shadow changed public schema/ACL/RLS/RPC');
    for (const table of before.tables) {
      const current = after.tables.find((item) => item.name === table.name);
      assert(current, `Shadow removed public table ${table.name}`);
      if (table.name === 'learning_state') assert.equal(current.rows, table.rows + 1);
      else assert.deepEqual(current, table, `Shadow changed ${table.name}`);
    }
    const shadowStates = stateRows();
    const added = shadowStates.filter((state) => state.user_id === settingsId);
    assert.equal(added.length, 1, 'Shadow must add exactly one state-only owner row');
    assert.equal(added[0].generation, 0);
    assert.deepEqual(
      shadowStates.filter((state) => state.user_id !== settingsId),
      states,
      'Shadow changed an existing learning_state column',
    );
    assert.deepEqual(privateRows(ownerIds), { accounts: 4, members: 4, grants: 2 });
    assert.deepEqual(privateRows([authOnlyId]), { accounts: 0, members: 0, grants: 0 });
    const grants =
      sql(`select jsonb_agg(session_id order by session_id) from kaq_private.learning_session_grants
      where auth_user_id = any(array[${issuers.map((issuer) => quoted(issuer.userId))}])`);
    assert.deepEqual(JSON.parse(grants), issuers.map((issuer) => issuer.sessionId).sort());
    writeFileSync(
      `${artifacts}/owner-shadow-proof.json`,
      JSON.stringify(
        {
          status: 'passed',
          ownerIds,
          authOnlyId,
          stateOnly: settingsId,
          grants: 2,
          publicSchemaUnchanged: true,
          stateGenerationZeroOnly: true,
          rollbackMetadata: {
            missingAuth,
            privateConflicts: 'retired,deleting,disabled,detached,epoch,membershipFence,accountFence',
            authUserNowait: authLock,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    const notAfter =
      originalNotAfter === null ? 'null' : `'${originalNotAfter.replaceAll("'", "''")}'::timestamptz`;
    sql(`update auth.sessions set not_after=${notAfter} where id=${session}`);
    await admin('DELETE', '', settingsId);
    await admin('DELETE', '', authOnlyId);
    await admin('GET', '', settingsId);
    await admin('GET', '', authOnlyId);
    await seeded.cleanup();
    removeShadowRows(ownerIds);
    assert.deepEqual(privateRows(ownerIds), { accounts: 0, members: 0, grants: 0 });
    assert.deepEqual(publicState(), publicBefore, 'Owner-shadow cleanup did not restore public state');
  }
}
