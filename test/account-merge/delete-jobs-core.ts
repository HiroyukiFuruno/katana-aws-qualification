import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sqlVerbose } from './commands';
import { ownersFromSmoke, quoted } from './owner-shadow-support';
import { publicState } from './public-state';

export function verifyDeleteJobsCore() {
  const owners = ownersFromSmoke();
  const before = publicState();
  const account = owners[0]?.userId;
  const anchor = owners[1]?.userId;
  assert(account && anchor, 'Expected two real OAuth owners');
  const source = readFileSync('test/account-merge/delete-jobs-core.sql', 'utf8')
    .replaceAll('%ACCOUNT%', quoted(account))
    .replaceAll('%ANCHOR%', quoted(anchor));
  const migration = readFileSync('supabase/account-merge/delete-jobs.sql', 'utf8');
  const output = sqlVerbose(source.replace('begin;', () => `begin;\n${migration}`));
  assert.match(output, /delete_job_core_assertions_passed/);
  assert.deepEqual(publicState(), before, 'Delete-job core rollback changed public state');
  return { status: 'passed', realOAuthOwners: 2, adminHttp: 'not exercised' } as const;
}
