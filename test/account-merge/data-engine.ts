import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashboardDefaults } from '../../src/dashboard/preferences';
import { sql } from './commands';
import { verifyDataEngineProjection } from './data-engine-projection';
import { shadowOwnerPrelude } from './data-engine-shadow';
import { privateState } from './data-engine-state';
import { ownersFromSmoke, quoted } from './owner-shadow-support';
import { publicState } from './public-state';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

export function dataEnginePublicSeed(userId: string) {
  return source('./seed-public.sql')
    .replaceAll('__SEED_USER_ID__', userId)
    .replaceAll(
      '__DASHBOARD_SETTINGS__',
      JSON.stringify(dashboardDefaults('UTC')).replaceAll("'", "''"),
    );
}

function assertInstalled() {
  const installed: unknown = JSON.parse(
    sql(`select jsonb_build_object(
      'snapshot', to_regprocedure('kaq_private.capture_merge_snapshot_v2(uuid[],uuid)') is not null,
      'engine', to_regprocedure('kaq_private.apply_merge_data_engine(uuid,uuid,uuid,text,bigint,jsonb)') is not null,
      'choices', to_regclass('kaq_private.account_merge_resolution_choices') is not null,
      'deferred', to_regclass('kaq_private.account_merge_deferred_rows') is not null,
      'resume', to_regclass('kaq_private.account_merge_resume_heads') is not null,
      'replay', to_regclass('kaq_private.account_merge_replay_heads') is not null,
      'lineage', to_regclass('kaq_private.account_merge_lineage_closure') is not null
    )`),
  );
  assert.deepEqual(installed, {
    snapshot: true,
    engine: true,
    choices: true,
    deferred: true,
    resume: true,
    replay: true,
    lineage: true,
  });
}

function assertSeededOwners(sourceOwner: string, canonicalOwner: string) {
  for (const table of [
    'assessment_answers',
    'dashboard_settings',
    'earned_certifications',
    'exam_responses',
    'exam_sessions',
    'fundamentals_final_sessions',
    'fundamentals_unit_progress',
    'learning_events',
    'learning_state',
    'migration_items',
    'migration_manifests',
    'roadmap_profiles',
  ]) {
    assert.equal(
      sql(
        `select count(distinct user_id) from public.${table} where user_id in (${quoted(sourceOwner)},${quoted(canonicalOwner)})`,
      ),
      '2',
      `missing old-schema fixture rows in ${table}`,
    );
  }
}

export function verifyDataEngine() {
  assertInstalled();
  const [sourceOwner, canonicalOwner] = ownersFromSmoke();
  if (!sourceOwner || !canonicalOwner) throw new Error('Two real OAuth owners are required');
  assertSeededOwners(sourceOwner.userId, canonicalOwner.userId);
  const receipt = sql('select gen_random_uuid()');
  const intent = sql('select gen_random_uuid()');
  const prelude = shadowOwnerPrelude(sourceOwner, canonicalOwner, intent);
  const fixture = source('./data-engine.sql')
    .replaceAll('__SOURCE_ACCOUNT__', sourceOwner.userId)
    .replaceAll('__CANONICAL_ACCOUNT__', canonicalOwner.userId)
    .replaceAll('__INTENT_ID__', intent)
    .replaceAll('__RECEIPT_ID__', receipt);
  const beforePublic = publicState();
  const beforePrivate = privateState();
  let output = '';
  try {
    output = sql(`begin;
${prelude}
${fixture}
rollback;`);
  } finally {
    assert.deepEqual(
      publicState(),
      beforePublic,
      'fixture transaction must restore every public row and schema',
    );
    assert.equal(
      privateState(),
      beforePrivate,
      'fixture rollback must restore every private row, receipt, and catalog digest',
    );
  }
  const receipts = output.split('\n').filter((line) => line.startsWith('{'));
  assert.equal(receipts.length, 1);
  const result: unknown = JSON.parse(receipts[0] ?? 'null');
  assert(result && typeof result === 'object' && 'status' in result && result.status === 'source-ready');
  verifyDataEngineProjection(result);
  return result;
}
