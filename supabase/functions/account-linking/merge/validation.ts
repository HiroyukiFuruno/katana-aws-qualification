import { identity } from './preview-values.ts';
import {
  type AuxiliaryInput,
  type MergeSource,
  type PublicTable,
  publicTables,
  type RawRow,
} from './types.ts';
import { isRecord, validateUsedRow } from './validation-used.ts';

export { rawColumns } from './validation-columns.ts';

import { rawColumns } from './validation-columns.ts';
import { validateV2Source } from './validation-v2.ts';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const privateTables = [
  'kaq_private.learning_accounts',
  'kaq_private.learning_memberships',
  'kaq_private.account_merge_receipts',
  'kaq_private.account_merge_archives',
  'kaq_private.account_merge_id_maps',
] as const;

function record(value: unknown): RawRow {
  if (!isRecord(value)) throw new Error('merge snapshot row must be an object');
  return value;
}

function json(value: unknown): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
  } else if (Array.isArray(value)) {
    value.forEach(json);
    return;
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(json);
    return;
  }
  throw new Error('merge snapshot contains non-JSON value');
}

function rows(source: MergeSource, table: PublicTable): RawRow[] {
  const value = source.snapshot.document.tables[`public.${table}`];
  if (!Array.isArray(value)) throw new Error(`merge snapshot missing public.${table}`);
  const checked = value.map((item) => {
    const row = record(item);
    if (Object.keys(row).sort().join(',') !== [...rawColumns[table]].sort().join(','))
      throw new Error(`merge snapshot columns changed for public.${table}`);
    if (row.user_id !== source.accountId)
      throw new Error(`merge snapshot owner mismatch for public.${table}`);
    json(row);
    validateUsedRow(table, row);
    return row;
  });
  const identities = checked.map((row) => identity(table, row));
  if (new Set(identities).size !== identities.length)
    throw new Error(`merge snapshot has duplicate public.${table} identity`);
  return checked;
}

export function validateSource(
  value: unknown,
  provenance: MergeSource['provenance'],
): Map<PublicTable, RawRow[]> {
  if (!isRecord(value) || !isRecord(value.snapshot) || !isRecord(value.snapshot.document))
    throw new Error('merge snapshot shape is invalid');
  const source = value as MergeSource;
  if (
    source.provenance !== provenance ||
    !uuid.test(source.accountId) ||
    source.accountId === '00000000-0000-0000-0000-000000000000' ||
    !/^[0-9a-f]{64}$/.test(source.snapshot.sqlDigest)
  )
    throw new Error('merge snapshot identity is invalid');
  const { document } = source.snapshot;
  if (document.algorithm_version === 2) return validateV2Source(source);
  if (
    document.algorithm_version !== 1 ||
    !Array.isArray(document.accounts) ||
    document.accounts.length !== 1 ||
    document.accounts[0] !== source.accountId ||
    !isRecord(document.tables)
  )
    throw new Error('merge snapshot binding is invalid');
  const names = Object.keys(document.tables).sort();
  const expected = [...publicTables.map((table) => `public.${table}`), ...privateTables].sort();
  if (names.join(',') !== expected.join(','))
    throw new Error('merge snapshot public table inventory changed');
  for (const table of privateTables) {
    const value = document.tables[table];
    if (!Array.isArray(value)) throw new Error(`merge snapshot missing ${table}`);
    value.forEach(json);
  }
  return new Map(publicTables.map((table) => [table, rows(source, table)]));
}

export function validateAuxiliary(value: unknown): AuxiliaryInput | undefined {
  if (!value) return undefined;
  if (!isRecord(value)) throw new Error('merge projection auxiliary input is invalid');
  const auxiliary = value as AuxiliaryInput;
  if (Object.keys(value).some((key) => !['version', 'examResume', 'manifestReplayHeads'].includes(key)))
    throw new Error('merge projection auxiliary input is invalid');
  if (
    auxiliary.version !== 1 ||
    !Array.isArray(auxiliary.examResume ?? []) ||
    !Array.isArray(auxiliary.manifestReplayHeads ?? [])
  )
    throw new Error('merge projection auxiliary input is invalid');
  for (const item of auxiliary.examResume ?? []) {
    if (
      !isRecord(item) ||
      Object.keys(item).sort().join(',') !== 'certificationId,examId' ||
      Object.values(item).some((field) => typeof field !== 'string' || !field)
    )
      throw new Error('merge projection auxiliary choice is invalid');
  }
  for (const item of auxiliary.manifestReplayHeads ?? []) {
    if (
      !isRecord(item) ||
      Object.keys(item).sort().join(',') !== 'manifestId,sourceFingerprint,sourceName' ||
      Object.values(item).some((field) => typeof field !== 'string' || !field)
    )
      throw new Error('merge projection auxiliary choice is invalid');
  }
  return auxiliary;
}
