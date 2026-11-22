import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataMigrations } from './data-migrations';

const migration = '202611220004_learning_account_creation.sql';

test('registers private createNew source after session grants without public cutover', async () => {
  expect(dataMigrations.filter((name) => name === migration)).toEqual([migration]);
  expect(dataMigrations.at(-1)).toBe(migration);
  const source = await readFile(
    join(new URL('..', import.meta.url).pathname, 'supabase/migrations', migration),
    'utf8',
  );
  expect(source).toMatch(/begin;\nset transaction isolation level serializable;/i);
  expect(source).toMatch(/\ncommit;\s*$/i);
  for (const name of ['learning_account_creation_receipts', 'create_learning_account'])
    expect(source).toContain(`kaq_private.${name}`);
  expect(source).toMatch(/auth_user_id uuid not null unique/i);
  expect(source).toMatch(/reason\)\s*values\(actor_session_id.*'created'/is);
  expect(source).toMatch(/jsonb_build_object\('receipt_id', receipt\.id/is);
  expect(source).toMatch(/for update[\s\S]*auth\.sessions[\s\S]*for share nowait/i);
  expect(source.match(/assert_live_session\(actor_uid, actor_session_id, false\)/g)).toHaveLength(2);
  expect(source).toMatch(/revoke all on (?:table|function) kaq_private\./gi);
  expect(source).not.toMatch(/create function public\.|alter table public\.|create policy/i);
});
