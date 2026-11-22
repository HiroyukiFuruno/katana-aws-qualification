import { createHash } from 'node:crypto';
import { publicState } from '../account-merge/public-state';
import { sql } from './sql';

const privateTables = [
  'account_committed_proof_bindings',
  'account_intents',
  'account_merge_archives',
  'account_merge_id_maps',
  'account_merge_receipts',
  'account_proof_legs',
  'account_proof_runtime',
  'account_proofs',
  'account_protocol_settings',
  'learning_accounts',
  'learning_account_creation_receipts',
  'learning_memberships',
  'learning_session_grants',
]
  .map((name) => `kaq_private.${name}`)
  .sort();

export function fingerprint() {
  return createHash('sha256').update(JSON.stringify(publicState())).digest('hex');
}

export function protectedTables() {
  const tables = sql(
    "select schemaname||'.'||tablename from pg_tables where schemaname in ('auth','kaq_private') and not(schemaname='auth' and tablename='audit_log_entries') order by schemaname,tablename;",
  ).split('\n');
  if (
    JSON.stringify(tables.filter((name) => name.startsWith('kaq_private.'))) !==
      JSON.stringify(privateTables) ||
    tables.some((name) => !/^(?:auth|kaq_private)\.[a-z_]+$/.test(name))
  )
    throw new Error('Unexpected SDK protected-table inventory');
  return tables;
}

export function protectedHash() {
  const tables = protectedTables();
  const parts = tables.map(
    (table) =>
      `select '${table}' relation,encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by to_jsonb(row)::text),'[]'::jsonb)::text,'sha256'),'hex') digest from ${table} row`,
  );
  return sql(
    `select encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(row) order by relation),'[]'::jsonb)::text,'sha256'),'hex') from (${parts.join(' union all ')}) row;`,
  );
}

export function learnerCount() {
  return sql(
    "select count(*) from auth.users where email in ('first@account-merge.example.test','second@account-merge.example.test')",
  );
}
