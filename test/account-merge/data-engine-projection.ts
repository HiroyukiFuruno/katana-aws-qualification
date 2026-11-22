import assert from 'node:assert/strict';
import { projectMergePreview } from '../../supabase/functions/account-linking/merge/preview.ts';
import {
  publicTables,
  type SnapshotDocument,
} from '../../supabase/functions/account-linking/merge/types.ts';

const privateTables = [
  'kaq_private.learning_accounts',
  'kaq_private.learning_memberships',
  'kaq_private.account_merge_receipts',
  'kaq_private.account_merge_archives',
  'kaq_private.account_merge_id_maps',
  'kaq_private.account_merge_resolution_choices',
  'kaq_private.account_merge_deferred_rows',
  'kaq_private.account_merge_resume_heads',
  'kaq_private.account_merge_replay_heads',
  'kaq_private.account_merge_lineage_closure',
] as const;
const tableNames = [...publicTables.map((table) => `public.${table}`), ...privateTables].sort();
type RecordValue = Record<string, unknown>;
type CapturedSnapshot = { accountId: string; sqlDigest: string; document: SnapshotDocument };

function object(value: unknown, label: string): RecordValue {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value as RecordValue;
}

function snapshot(value: unknown, label: string): CapturedSnapshot {
  const input = object(value, label);
  const accountId = input.account_id;
  const rawSnapshot = object(input.snapshot, `${label}.snapshot`);
  const document = object(rawSnapshot.document, `${label}.snapshot.document`);
  const tables = object(document.tables, `${label}.snapshot.document.tables`);
  const fingerprints = object(rawSnapshot.fingerprints, `${label}.snapshot.fingerprints`);
  const fingerprintTables = object(fingerprints.tables, `${label}.snapshot.fingerprints.tables`);
  assert.equal(document.algorithm_version, 2, `${label} must use snapshot v2`);
  assert.equal(fingerprints.algorithm_version, 2, `${label} fingerprint must use snapshot v2`);
  assert(typeof accountId === 'string', `${label} account id is required`);
  assert.deepEqual(document.accounts, [accountId], `${label} account binding changed`);
  assert(
    Array.isArray(document.lineage_accounts) && document.lineage_accounts.includes(accountId),
    `${label} lineage binding changed`,
  );
  assert.deepEqual(Object.keys(tables).sort(), tableNames, `${label} table inventory changed`);
  assert.deepEqual(
    Object.keys(fingerprintTables).sort(),
    tableNames,
    `${label} fingerprint inventory changed`,
  );
  for (const table of tableNames) {
    const rows = tables[table];
    const fingerprint = object(fingerprintTables[table], `${label} ${table} fingerprint`);
    assert(Array.isArray(rows), `${label} ${table} rows must be an array`);
    assert.equal(fingerprint.count, rows.length, `${label} ${table} raw count changed`);
    assert(Array.isArray(fingerprint.row_hashes), `${label} ${table} row hashes are required`);
    assert.equal(fingerprint.row_hashes.length, rows.length, `${label} ${table} row hash count changed`);
  }
  for (const table of publicTables)
    assert((tables[`public.${table}`] as unknown[]).length > 0, `${label} ${table} must be seeded`);
  const sqlDigest = rawSnapshot.digest;
  assert(typeof sqlDigest === 'string', `${label} SQL digest is required`);
  assert.match(sqlDigest, /^[0-9a-f]{64}$/, `${label} SQL digest is invalid`);
  return { accountId, sqlDigest, document: document as SnapshotDocument };
}

export function verifyDataEngineProjection(value: unknown) {
  const result = object(value, 'data engine result');
  const snapshots = object(result.projection_snapshots, 'data engine projection snapshots');
  assert.deepEqual(Object.keys(snapshots).sort(), ['source', 'target']);
  const source = snapshot(snapshots.source, 'source');
  const target = snapshot(snapshots.target, 'target');
  const sourceDocument = JSON.stringify(source.document);
  const targetDocument = JSON.stringify(target.document);
  const plan = projectMergePreview({
    source: {
      accountId: source.accountId,
      provenance: 'source',
      snapshot: { sqlDigest: source.sqlDigest, document: source.document },
    },
    target: {
      accountId: target.accountId,
      provenance: 'target',
      snapshot: { sqlDigest: target.sqlDigest, document: target.document },
    },
  });
  assert.equal(
    JSON.stringify(source.document),
    sourceDocument,
    'projection must not mutate source document',
  );
  assert.equal(
    JSON.stringify(target.document),
    targetDocument,
    'projection must not mutate target document',
  );
  // digest は SQL snapshot の正本をそのまま projection へ通す。Node で再計算しない。
  assert.deepEqual(plan.sqlDigests, { source: source.sqlDigest, target: target.sqlDigest });
  assert.deepEqual(new Set(plan.retained.map((row) => row.table)), new Set(publicTables));
  for (const table of publicTables) {
    const name = `public.${table}`;
    const sourceRows = source.document.tables[name];
    const targetRows = target.document.tables[name];
    assert(Array.isArray(sourceRows) && Array.isArray(targetRows), `${table} raw rows are required`);
    const projectedRows = plan.retained.filter((row) => row.table === table).length;
    const duplicateRows = plan.duplicates.filter((row) => row.table === table).length;
    assert.equal(
      projectedRows + duplicateRows,
      sourceRows.length + targetRows.length,
      `${table} projection row count changed`,
    );
  }
  return plan;
}
