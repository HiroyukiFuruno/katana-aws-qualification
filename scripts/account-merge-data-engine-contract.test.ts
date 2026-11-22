import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const engine = readFileSync('supabase/account-merge/data-engine.sql', 'utf8');
const proposal = readFileSync('supabase/account-merge/data-engine-proposal.sql', 'utf8');
const fixture = readFileSync('test/account-merge/data-engine.sql', 'utf8');
const runner = readFileSync('test/account-merge/data-engine.ts', 'utf8');
const tables = [
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
];

test('private engine binds a trusted digest, archives every owner table, and exposes no API grant', () => {
  for (const table of tables) expect(engine).toContain(`'${table}'`);
  expect(engine).toContain('capture_merge_snapshot_v2');
  expect(engine).toContain('KAQ_MERGE_DIGEST_CHANGED');
  expect(engine).toContain('KAQ_MERGE_SNAPSHOT_ALGORITHM_CHANGED');
  expect(engine).toContain('receipt.algorithm_version <> 2');
  expect(engine).toContain('archive_merge_snapshot');
  expect(engine).toContain('declare v_table_name text; v_payload jsonb; v_origin uuid; v_row_key jsonb');
  expect(engine).not.toContain('declare table_name text; payload jsonb; origin uuid; row_key jsonb');
  expect(engine).toContain('revoke all on function kaq_private.apply_merge_data_engine');
  expect(engine).not.toContain('grant execute');
});

test('proposal replaces only asserted legacy uniqueness and preserves all drafts and manifest variants', () => {
  expect(proposal).toContain('KAQ_MERGE_FINAL_UNIQUE_CHANGED');
  expect(proposal).toContain('drop index public.fundamentals_one_active_final_per_unit_version_idx');
  expect(proposal).toContain(
    'drop constraint migration_manifests_user_id_source_name_source_fingerprint_key',
  );
  expect(proposal).toContain('account_merge_resume_heads');
  expect(proposal).toContain('account_merge_replay_heads');
  expect(proposal).toContain('KAQ_MERGE_EXAM_KEY_CHANGED');
  expect(proposal).toContain('drop constraint exam_sessions_pkey');
  expect(proposal).toContain('add constraint exam_sessions_pkey primary key (user_id, exam_id)');
  expect(proposal).not.toContain('drop constraint exam_sessions_user_id_exam_id_key');
  expect(proposal).toContain('KAQ_MERGE_MANIFEST_HEAD_REQUIRED');
  expect(proposal).not.toContain('on conflict (user_id, source_name, source_fingerprint)');
  expect(proposal).toContain('foreign key (canonical_account_id, session_id, unit_id, content_version)');
  expect(proposal).toContain(
    'references public.fundamentals_final_sessions(user_id, session_id, unit_id, content_version)',
  );
  expect(proposal).not.toContain('references public.fundamentals_final_sessions(session_id)');
  expect(proposal).toContain('foreign key (canonical_account_id, manifest_id)');
  expect(proposal).toContain('references public.migration_manifests(user_id, manifest_id)');
  expect(proposal).not.toContain('references public.migration_manifests(manifest_id)');
  expect(proposal).toContain(
    'alter table kaq_private.account_merge_lineage_closure enable row level security',
  );
  expect(proposal).toContain('revoke all on table');
});

test('engine maps collision IDs before dependent rows and leaves continuity unpromoted', () => {
  for (const kind of ['event', 'exam', 'final', 'manifest']) expect(engine).toContain(`'${kind}'`);
  expect(engine).toContain('public.exam_responses');
  expect(engine).toContain('public.migration_items');
  expect(engine).toContain("'continuity_promoted', false");
  expect(engine).toContain('KAQ_MERGE_CHOICE_REQUIRED');
  expect(engine).toContain('guest_exam_is_equivalent');
  expect(engine).toContain("- 'submitted_received_at'");
  expect(engine).toContain("- 'updated_at'");
  expect(engine).toContain('KAQ_MERGE_EXAM_RESPONSE_CONFLICT');
  expect(engine).toContain('KAQ_MERGE_ROW_CHOICE_REQUIRED');
  expect(engine).toContain('require_merge_row_choice');
  expect(engine).not.toContain('order by created_at limit 1');
});

test('engine rejects absent choices and binds every dependent reference after parent maps', () => {
  expect(engine).toContain("p_choices->>'version' is distinct from '1'");
  expect(engine).toContain("if choice is null or choice not in ('source', 'canonical')");
  expect(engine).toContain('p_expected_digest is null');
  const parentMaps = engine.indexOf(
    "foreach item in array array['exam_sessions', 'fundamentals_final_sessions', 'migration_manifests']",
  );
  const childEvents = engine.indexOf(
    "for row in select value from jsonb_array_elements(snapshot->'document'->'tables'->'public.learning_events') loop",
  );
  expect(parentMaps).toBeGreaterThanOrEqual(0);
  expect(childEvents).toBeGreaterThan(parentMaps);
  expect(engine).toContain("'{exam_id}'");
  expect(engine).toContain("'{fundamentals_session_id}'");
  expect(engine).toContain("'{event_id}'");
  expect(engine).not.toContain('on conflict do nothing');
});

test('guest imports deduplicate only through the original manifest/item provenance contracts', () => {
  expect(engine).toContain('find_guest_import_map');
  expect(engine).toContain('source_row_id = source_item.source_row_id');
  expect(engine).toContain('source_item.import_kind is null');
  expect(engine).toContain('canonical_event.payload_hash = p_payload_hash');
  expect(engine).toContain("source_item.import_kind = 'exam-session'");
  expect(engine).not.toContain('received_at =');
});

test('native helper uses real smoke owners and rolls the proposal, engine, rows, and schema back together', () => {
  expect(runner).toContain('ownersFromSmoke()');
  expect(runner).toContain('begin;');
  expect(runner).toContain('rollback;');
  expect(runner).toContain('publicState()');
  expect(runner).toContain('assertSeededOwners');
  expect(runner).not.toContain("source('../../supabase/account-merge/data-engine-proposal.sql')");
  expect(runner).not.toContain("source('../../supabase/account-merge/data-engine.sql')");
  expect(runner).not.toContain('docker compose up');
  expect(fixture).toContain("archived_count_' || table_key");
  expect(fixture).toContain("archived_payloads_' || table_key");
  expect(fixture).toContain('all_raw_payload_hashes_retained');
  expect(fixture).toContain('id_map_hashes_match_canonical_rows');
  expect(fixture).toContain('foreign_keys_preserved');
  expect(fixture).toContain('canonical_count_not_lost_');
  expect(fixture).toContain('non_equivalent_guest_exam_remapped');
  expect(fixture).toContain('non_equivalent_guest_event_remapped');
  expect(fixture).toContain('final_id_collision_remapped');
  expect(fixture).toContain('source_only_progress_uses_selected_active_final');
  expect(fixture).toContain('final_heads_use_selected_original');
  expect(fixture).toContain('manifest_heads_use_selected_original');
  expect(fixture).toContain('capture_merge_snapshot_v2(array[source_account, canonical_account], null)');
  expect(fixture).toContain('proposal_rls_');
  expect(fixture).toContain('proposal_api_privileges_');
  expect(fixture).toContain("array['anon', 'authenticated', 'service_role']");
});
