import { privateV2Tables, privateV2Types } from './validation-private-v2-columns.ts';

type Row = Record<string, unknown>;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
  hex = /^(?:\\x)?[0-9a-f]{64}$/i,
  zero = '00000000-0000-0000-0000-000000000000';

export { privateV2Tables };

const object = (v: unknown, l: string): Row => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${l} must be an object`);
  return v as Row;
};
const text = (v: unknown, l: string) => {
  if (typeof v !== 'string' || !v) throw new Error(`${l} must be text`);
};
const enums: Record<string, readonly string[]> = {
  'account-status': ['active', 'retired', 'deleting'],
  'membership-status': ['active', 'detached', 'disabled'],
  'archive-table': [
    'learning_state',
    'learning_events',
    'exam_sessions',
    'exam_responses',
    'earned_certifications',
    'assessment_answers',
    'migration_manifests',
    'migration_items',
    'roadmap_profiles',
    'fundamentals_unit_progress',
    'fundamentals_final_sessions',
    'dashboard_settings',
    'exam_resume_choices',
  ],
  'entity-kind': ['event', 'exam', 'final', 'manifest'],
  'choice-kind': ['assessment', 'dashboard', 'roadmap', 'exam_resume', 'final_resume', 'manifest_head'],
  'deferred-table': ['fundamentals_final_sessions', 'migration_manifests', 'migration_items'],
  'deferred-reason': ['unselected_draft', 'unselected_manifest_variant'],
};
const field = (value: unknown, kind: string, label: string) => {
  const nullable = kind.endsWith('-nullable');
  if (value === null && nullable) return;
  if (value === null) throw new Error(`${label} must not be null`);
  const base = nullable ? kind.slice(0, -'-nullable'.length) : kind;
  if (base === 'uuid' && (typeof value !== 'string' || !uuid.test(value) || value === zero))
    throw new Error(`${label} must be UUID`);
  if (base === 'hash' && (typeof value !== 'string' || !hex.test(value)))
    throw new Error(`${label} must be a 32-byte hash`);
  if (base === 'text') text(value, label);
  if (base === 'timestamp' && (typeof value !== 'string' || Number.isNaN(Date.parse(value))))
    throw new Error(`${label} must be timestamp`);
  if (base === 'json-object' && (!value || typeof value !== 'object' || Array.isArray(value)))
    throw new Error(`${label} must be JSON object`);
  if (base === 'json-array' && !Array.isArray(value)) throw new Error(`${label} must be JSON array`);
  if (base === 'natural' && (!Number.isInteger(value) || Number(value) < 0))
    throw new Error(`${label} must be nonnegative integer`);
  if (base === 'positive' && (!Number.isInteger(value) || Number(value) <= 0))
    throw new Error(`${label} must be positive integer`);
  if (enums[base] && (typeof value !== 'string' || !enums[base].includes(value)))
    throw new Error(`${label} violates its SQL enum`);
};
export function validatePrivateV2(document: unknown, accountId: string) {
  const root = object(document, 'merge snapshot document');
  const accounts = root.accounts,
    lineage = root.lineage_accounts;
  if (
    Object.keys(root).sort().join(',') !== 'accounts,algorithm_version,lineage_accounts,tables' ||
    root.algorithm_version !== 2 ||
    !Array.isArray(accounts) ||
    !Array.isArray(lineage) ||
    !accounts.every((v) => typeof v === 'string' && uuid.test(v)) ||
    accounts.length < 1 ||
    accounts.length > 2 ||
    new Set(accounts).size !== accounts.length ||
    accounts.join(',') !== [...accounts].sort().join(',') ||
    accounts.some((value) => value === '00000000-0000-0000-0000-000000000000') ||
    !accounts.includes(accountId) ||
    !lineage.every((v) => typeof v === 'string' && uuid.test(v)) ||
    lineage.some((value) => value === zero) ||
    new Set(lineage).size !== lineage.length ||
    lineage.join(',') !== [...lineage].sort().join(',') ||
    accounts.some((v) => !lineage.includes(v))
  )
    throw new Error('merge snapshot v2 lineage is invalid');
  const snapshot = object(root.tables, 'merge snapshot tables');
  if (
    Object.keys(snapshot)
      .filter((name) => name.startsWith('kaq_private.'))
      .sort()
      .join(',') !== privateV2Tables.join(',')
  )
    throw new Error('merge snapshot v2 private inventory changed');
  for (const [table, columns] of Object.entries(privateV2Types)) {
    const rows = snapshot[table];
    if (!Array.isArray(rows)) throw new Error(`merge snapshot missing ${table}`);
    for (const value of rows) {
      const row = object(value, table);
      if (Object.keys(row).sort().join(',') !== Object.keys(columns).sort().join(','))
        throw new Error(`merge snapshot columns changed for ${table}`);
      for (const [key, kind] of Object.entries(columns as Record<string, string>))
        field(row[key], kind, `${table}.${key}`);
    }
  }
}
