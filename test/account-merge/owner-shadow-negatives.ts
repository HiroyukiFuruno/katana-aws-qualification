import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sql } from './commands';
import { ownerShadowDo, runMissingAuthBody } from './owner-shadow-source';
import { publicState } from './public-state';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const quoted = (value: string) => {
  if (!uuid.test(value)) throw new Error('Invalid owner-shadow UUID');
  return `'${value}'::uuid`;
};

function rejected(apply: () => void, label: string, message: string) {
  try {
    apply();
  } catch (error: unknown) {
    const actual = error instanceof Error ? error.message : String(error);
    assert.match(actual, /PT400/, `Rejected ${label} did not return PT400`);
    assert.match(actual, new RegExp(message), `Rejected ${label} returned the wrong error`);
    return;
  }
  throw new Error(`Owner shadow migration accepted ${label}`);
}

function assertRollback(before: ReturnType<typeof publicState>, label: string) {
  assert.deepEqual(publicState(), before, `Rejected ${label} changed public state`);
  assert.equal(sql('select count(*) from kaq_private.learning_accounts'), '0');
  assert.equal(sql('select count(*) from kaq_private.learning_memberships'), '0');
  assert.equal(sql('select count(*) from kaq_private.learning_session_grants'), '0');
}

function dashboardCatalog() {
  return sql(`select coalesce(jsonb_agg(jsonb_build_object('name',conname,
    'definition',pg_get_constraintdef(oid),'validated',convalidated) order by conname),'[]'::jsonb)
    from pg_constraint where conrelid='public.dashboard_settings'::regclass`);
}

function authUsersHash() {
  return sql(`select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),
    '[]'::jsonb)::text,'sha256'),'hex') from auth.users row`);
}

export function verifyMissingAuthRollback() {
  const before = publicState();
  const catalog = dashboardCatalog();
  const auth = authUsersHash();
  const body = ownerShadowDo();
  const result = runMissingAuthBody(randomUUID());
  assert.match(result.output, /PT400: KAQ_OWNER_SHADOW_AUTH_MISSING/);
  assert.equal(body.body.length > 0, true);
  assert.match(body.sourceHash, /^[a-f0-9]{64}$/);
  assert.match(body.bodyHash, /^[a-f0-9]{64}$/);
  assertRollback(before, 'missing Auth owner');
  assert.equal(dashboardCatalog(), catalog, 'Missing Auth rollback changed the FK catalog');
  assert.equal(authUsersHash(), auth, 'Missing Auth rollback changed Auth users');
  return { sourceHash: body.sourceHash, doHash: body.bodyHash, sqlstate: 'PT400' };
}

export function verifyPrivateConflictRollbacks(apply: () => void, ownerId: string) {
  const owner = quoted(ownerId);
  const cases = [
    [
      'retired account',
      `insert into kaq_private.learning_accounts(id,status,retired_at) values(${owner},'retired',clock_timestamp())`,
    ],
    [
      'deleting account',
      `insert into kaq_private.learning_accounts(id,status) values(${owner},'deleting')`,
    ],
    [
      'disabled membership',
      `insert into kaq_private.learning_accounts(id) values(${owner});
      insert into kaq_private.learning_memberships(auth_user_id,account_id,status) values(${owner},${owner},'disabled')`,
    ],
    [
      'detached membership',
      `insert into kaq_private.learning_accounts(id) values(${owner});
      insert into kaq_private.learning_memberships(auth_user_id,account_id,status) values(${owner},${owner},'detached')`,
    ],
    [
      'membership epoch',
      `insert into kaq_private.learning_accounts(id) values(${owner});
      insert into kaq_private.learning_memberships(auth_user_id,account_id,epoch) values(${owner},${owner},1)`,
    ],
    [
      'membership fence',
      `insert into kaq_private.learning_accounts(id) values(${owner});
      insert into kaq_private.learning_memberships(auth_user_id,account_id,session_fence_at) values(${owner},${owner},clock_timestamp())`,
    ],
    [
      'account fence',
      `insert into kaq_private.learning_accounts(id,session_fence_at) values(${owner},clock_timestamp())`,
    ],
  ] as const;
  for (const [label, setup] of cases) {
    const before = publicState();
    sql(setup);
    try {
      rejected(apply, label, 'KAQ_OWNER_SHADOW_PRIVATE_CONFLICT');
    } finally {
      sql(`delete from kaq_private.learning_session_grants where auth_user_id=${owner};
        delete from kaq_private.learning_memberships where auth_user_id=${owner};
        delete from kaq_private.learning_accounts where id=${owner}`);
    }
    assertRollback(before, label);
  }
}
