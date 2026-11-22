import { identity } from './preview-values.ts';
import { type MergeSource, type PublicTable, publicTables, type RawRow } from './types.ts';
import { rawColumns } from './validation-columns.ts';
import { privateV2Tables, validatePrivateV2 } from './validation-private-v2.ts';
import { isRecord, validateUsedRow } from './validation-used.ts';

export const rawColumnsV2: Record<PublicTable, readonly string[]> = {
  ...rawColumns,
  fundamentals_final_sessions: [...rawColumns.fundamentals_final_sessions, 'is_active'],
};

const record = (value: unknown): RawRow => {
  if (!isRecord(value)) throw new Error('merge snapshot row must be an object');
  return value;
};
const json = (value: unknown): void => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach(json);
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(json);
    return;
  }
  throw new Error('merge snapshot contains non-JSON value');
};
const rows = (source: MergeSource, table: PublicTable): RawRow[] => {
  const value = source.snapshot.document.tables[`public.${table}`];
  if (!Array.isArray(value)) throw new Error(`merge snapshot missing public.${table}`);
  const checked = value.map((item) => {
    const row = record(item);
    if (Object.keys(row).sort().join(',') !== [...rawColumnsV2[table]].sort().join(','))
      throw new Error(`merge snapshot columns changed for public.${table}`);
    if (row.user_id !== source.accountId)
      throw new Error(`merge snapshot owner mismatch for public.${table}`);
    json(row);
    validateUsedRow(table, row);
    if (
      table === 'fundamentals_final_sessions' &&
      (typeof row.is_active !== 'boolean' || (row.is_active && row.state !== 'draft'))
    )
      throw new Error('merge snapshot final activity is invalid');
    return row;
  });
  const identities = checked.map((row) => identity(table, row));
  if (new Set(identities).size !== identities.length)
    throw new Error(`merge snapshot has duplicate public.${table} identity`);
  return checked;
};

export function validateV2Source(source: MergeSource): Map<PublicTable, RawRow[]> {
  const document = source.snapshot.document;
  if (
    Object.keys(document).sort().join(',') !== 'accounts,algorithm_version,lineage_accounts,tables' ||
    document.algorithm_version !== 2 ||
    !Array.isArray(document.accounts) ||
    document.accounts.length !== 1 ||
    document.accounts[0] !== source.accountId ||
    !isRecord(document.tables)
  )
    throw new Error('merge snapshot v2 binding is invalid');
  validatePrivateV2(document, source.accountId);
  const expected = [...publicTables.map((table) => `public.${table}`), ...privateV2Tables].sort();
  if (Object.keys(document.tables).sort().join(',') !== expected.join(','))
    throw new Error('merge snapshot v2 table inventory changed');
  return new Map(publicTables.map((table) => [table, rows(source, table)]));
}
