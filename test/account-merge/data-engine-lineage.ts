import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sql } from './commands';
import { type NativeOwner } from './data-engine-native-support';
import { privateState } from './data-engine-state';
import { ownersFromSmoke, quoted } from './owner-shadow-support';
import { publicState } from './public-state';

function fixture() {
  return readFileSync(new URL('./data-engine-lineage-fixture.sql', import.meta.url), 'utf8');
}

export function verifyDataEngineLineage(owner: NativeOwner) {
  const [a, b] = ownersFromSmoke();
  if (!a || !b) throw new Error('Two smoke owners are required');
  const cSession = sql(
    `select id from auth.sessions where user_id=${quoted(owner.userId)} order by created_at desc limit 1`,
  );
  if (!cSession) throw new Error('SDK owner has no real Auth session');
  const beforePublic = publicState();
  const beforePrivate = privateState();
  const input = fixture()
    .replaceAll('__A_ACCOUNT__', a.userId)
    .replaceAll('__B_ACCOUNT__', b.userId)
    .replaceAll('__C_ACCOUNT__', owner.userId)
    .replaceAll('__A_AUTH_UID__', a.userId)
    .replaceAll('__B_AUTH_UID__', b.userId)
    .replaceAll('__C_AUTH_UID__', owner.userId)
    .replaceAll('__A_SESSION_ID__', a.sessionId)
    .replaceAll('__B_SESSION_ID__', b.sessionId)
    .replaceAll('__C_SESSION_ID__', cSession);
  try {
    sql(input);
  } finally {
    assert.deepEqual(publicState(), beforePublic, 'lineage rollback restores public rows and schema');
    assert.equal(privateState(), beforePrivate, 'lineage rollback restores private rows and grants');
  }
}
