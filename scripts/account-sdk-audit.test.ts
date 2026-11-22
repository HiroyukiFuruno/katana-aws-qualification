import { expect, test } from 'bun:test';
import { type Audit, validateAuditDelta } from '../test/account-sdk/server-audit';

const user = '11111111-1111-4111-8111-111111111111';
const alias = '22222222-2222-4222-8222-222222222222';
const admin = '00000000-0000-0000-0000-000000000000';
const row = (id: string, actor = user, action = 'login', target: string | null = null): Audit => ({
  id,
  actor,
  action,
  target,
  digest: 'a'.repeat(64),
});
const ownedAdmin = [
  row('create', admin, 'user_signedup', alias),
  row('delete', admin, 'user_deleted', alias),
];

test('only the dedicated alias admin creation/deletion pair is allowed', () => {
  const old = row('old');
  expect(validateAuditDelta([old], [old, row('login'), ...ownedAdmin], [user], [alias])).toMatchObject({
    existingRowsUnchanged: true,
    newRows: 3,
    adminAliasRows: 2,
    ownedAliases: [alias],
  });
});

for (const invalid of [
  row('foreign-admin', admin, 'user_deleted', user),
  row('admin-login', admin, 'login', alias),
  row('foreign-actor', alias, 'login'),
  row('foreign-target', user, 'login', alias),
])
  test(`unexpected audit ${invalid.id} is rejected`, () => {
    expect(() => validateAuditDelta([], [...ownedAdmin, invalid], [user], [alias])).toThrow(
      'Unexpected',
    );
  });

test('a missing alias creation/deletion partner is rejected', () => {
  expect(() => validateAuditDelta([], ownedAdmin.slice(0, 1), [user], [alias])).toThrow('exactly one');
});

test('existing audit rows may neither disappear nor change any hashed column', () => {
  const old = row('old');
  expect(() => validateAuditDelta([old], [], [user], [])).toThrow('existing');
  expect(() => validateAuditDelta([old], [{ ...old, digest: 'b'.repeat(64) }], [user], [])).toThrow(
    'existing',
  );
});
