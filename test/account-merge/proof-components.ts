import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { sql } from './commands';
import { fixedProofInputs } from './proof-inputs';
import { artifacts, gatewayOrigin } from './settings';

const components = ['proof-schema.sql', 'proof-accept.sql'] as const;
let installed = false;

export function installProofComponents() {
  assert.equal(installed, false, 'Proof components must be installed exactly once');
  assert.equal(sql('select count(*) from kaq_private.account_proofs'), '0');
  for (const name of components) sql(readFileSync(`supabase/account-merge/${name}`, 'utf8'));
  const issuer = `${gatewayOrigin}/auth/v1`;
  sql(`insert into kaq_private.account_protocol_settings(id,auth_issuer) values(true,'${issuer}')`);
  sql(readFileSync('test/account-merge/proof-wrapper.sql', 'utf8'));
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(
      sql(`select has_function_privilege('${role}',
        'public.fixture_accept_account_proof(uuid,uuid,bytea,bigint)','EXECUTE')`),
      role === 'authenticated' ? 't' : 'f',
    );
    assert.equal(
      sql(`select has_table_privilege('${role}',
        'kaq_private.account_protocol_settings','SELECT,INSERT,UPDATE,DELETE')`),
      'f',
    );
  }
  installed = true;
  let query = readFileSync('test/account-merge/proof-accept.sql', 'utf8');
  for (const [placeholder, value] of Object.entries(fixedProofInputs()))
    query = query.replaceAll(placeholder, value);
  const result: unknown = JSON.parse(
    sql(query)
      .split('\n')
      .find((line) => line.startsWith('{')) ?? 'null',
  );
  assert(result && typeof result === 'object' && 'status' in result && 'checks' in result);
  assert.equal(result.status, 'passed');
  assert(Array.isArray(result.checks) && result.checks.length === 49);
  assert(result.checks.every((name: unknown) => typeof name === 'string'));
  assert.equal(new Set(result.checks).size, 49);
  assert('fixedGucNegativesOnly' in result && result.fixedGucNegativesOnly === true);
  writeFileSync(`${artifacts}/proof-fixed-guc-negatives.json`, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(
    `${artifacts}/proof-component-install.json`,
    `${JSON.stringify(
      {
        status: 'passed',
        components,
        issuer,
        fixtureWrapperOnly: true,
        observedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}

export function removeProofWrapper() {
  if (!installed) return;
  sql('drop function public.fixture_accept_account_proof(uuid,uuid,bytea,bigint)');
  assert.equal(
    sql("select to_regprocedure('public.fixture_accept_account_proof(uuid,uuid,bytea,bigint)') is null"),
    't',
  );
  writeFileSync(
    `${artifacts}/proof-wrapper-cleanup.json`,
    `${JSON.stringify({ status: 'passed', wrapperRemoved: true }, null, 2)}\n`,
  );
  installed = false;
}
