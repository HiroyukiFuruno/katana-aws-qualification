import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dataMigrations } from '../../scripts/data-migrations';
import { sql } from '../account-merge/commands';
import { artifacts } from '../account-merge/settings';

const components = [
  'locking-scope.sql',
  'intent-control-schema.sql',
  'intent-control.sql',
  'runtime-schema.sql',
  'runtime-storage.sql',
  'runtime-cleanup.sql',
  'leg-schema.sql',
  'leg-control.sql',
  'exchange-control-schema.sql',
  'authorization-control.sql',
  'exchange-control.sql',
] as const;

let installed = false;

function contextHelpersAlreadyInstalled(): boolean {
  const migration = '202611220002_learning_context_helpers.sql';
  if (!dataMigrations.includes(migration)) return false;
  const count = sql(
    "select count(*) from (values (to_regprocedure('kaq_private.assert_live_session(uuid,uuid,boolean)')), (to_regprocedure('kaq_private.read_actor_session()')), (to_regprocedure('kaq_private.read_learning_account()')), (to_regprocedure('kaq_private.read_account_bootstrap()')), (to_regprocedure('kaq_private.lock_request_context()')), (to_regprocedure('kaq_private.lock_learning_scope(text,bigint,uuid[],uuid[])'))) as signatures(procedure) where procedure is not null",
  );
  assert.equal(count, '6', 'Context helper migration must install all six exact signatures');
  return true;
}

export function installSdkMetadata() {
  assert.equal(installed, false, 'SDK metadata installation must happen exactly once');
  const prior = sql('select count(*) from kaq_private.account_proof_legs');
  assert.equal(prior, '0', 'Install SDK metadata before creating synthetic SDK legs');
  const contextHelpers = contextHelpersAlreadyInstalled();
  for (const component of components) {
    if (contextHelpers && component === 'locking-scope.sql') continue;
    sql(readFileSync(`supabase/account-merge/${component}`, 'utf8'));
  }
  const functions = sql(
    "select count(*) from pg_proc where pronamespace='kaq_private'::regnamespace and proname in ('issue_account_leg','claim_authorization','complete_authorization','claim_exchange','runtime_promote_proof')",
  );
  assert.equal(functions, '5', 'SDK metadata must expose every private control function once');
  installed = true;
  writeFileSync(
    `${artifacts}/sdk-metadata-install.json`,
    `${JSON.stringify({ status: 'passed', components, contextHelpers, installedAt: new Date().toISOString() }, null, 2)}\n`,
  );
}
