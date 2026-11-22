import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from './commands';
import { artifacts } from './settings';

let installed = false;

export function installAccountCreationFixture() {
  assert.equal(installed, false, 'Creation fixture installation must happen once');
  sql(readFileSync('test/account-merge/account-creation-wrapper.sql', 'utf8'));
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(
      sql(`select has_function_privilege('${role}',
        'public.fixture_create_learning_account(boolean,uuid)','EXECUTE')`),
      role === 'authenticated' ? 't' : 'f',
    );
  installed = true;
  writeFileSync(
    `${artifacts}/account-creation-fixture.json`,
    `${JSON.stringify({ status: 'passed' }, null, 2)}\n`,
  );
}

export function removeAccountCreationFixture() {
  if (!installed) return;
  sql('drop function public.fixture_create_learning_account(boolean,uuid)');
  installed = false;
}
