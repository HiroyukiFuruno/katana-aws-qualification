import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { artifacts, compose } from './settings';

const file = 'supabase/migrations/202611220001_learning_owner_shadow.sql';
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');

export function ownerShadowDo() {
  const source = readFileSync(file);
  const start = source.indexOf(Buffer.from('do $owner_shadow$\n'));
  const end = source.indexOf(Buffer.from('end $owner_shadow$;'), start);
  if (start < 0 || end < start) throw new Error('Owner shadow DO body is missing');
  const finish = end + Buffer.byteLength('end $owner_shadow$;');
  const prefix = source.subarray(0, start).toString('utf8');
  const suffix = source.subarray(finish).toString('utf8');
  if (
    prefix !==
      '-- #58の最初のshadow/backfill。公開所有者境界はまだAuth UIDのまま維持する。\nbegin;\nset transaction isolation level serializable;\n\n' ||
    suffix !== '\n\ncommit;\n'
  )
    throw new Error('Owner shadow migration framing changed');
  const body = source.subarray(start, finish);
  return { body, sourceHash: hash(source), bodyHash: hash(body) };
}

export function runMissingAuthBody(missing: string) {
  const { body } = ownerShadowDo();
  const script = `begin;
set transaction isolation level serializable;
alter table public.dashboard_settings drop constraint dashboard_settings_user_id_fkey;
insert into public.dashboard_settings(user_id,settings) values('${missing}'::uuid,'{}'::jsonb);
${body.toString('utf8')}
rollback;
`;
  const result = spawnSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'database',
      'psql',
      '-v',
      'VERBOSITY=verbose',
      '-U',
      'supabase_auth_admin',
      '-d',
      'kaq_account_merge',
    ],
    { input: script, encoding: 'utf8' },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  appendFileSync(`${artifacts}/integration.log`, output);
  if (result.error) throw result.error;
  return { output, status: result.status };
}
