import { bindAuxiliary } from './preview-auxiliary.ts';
import { addConflicts } from './preview-conflicts.ts';
import { addFundamentals } from './preview-fundamentals.ts';
import { equalPayload, identity } from './preview-values.ts';
import { type ProjectionInput, type ProjectionPlan, publicTables, type RetainedRow } from './types.ts';
import { validateAuxiliary, validateSource } from './validation.ts';
import { isRecord } from './validation-used.ts';

function retain(
  plan: ProjectionPlan,
  table: RetainedRow['table'],
  provenance: RetainedRow['provenance'],
  raw: RetainedRow['raw'],
) {
  plan.retained.push({ table, provenance, identity: identity(table, raw), raw });
}

function projectRows(input: ProjectionInput, plan: ProjectionPlan) {
  const source = validateSource(input.source, 'source');
  const target = validateSource(input.target, 'target');
  for (const table of publicTables) {
    const right = new Map(target.get(table)?.map((row) => [identity(table, row), row]) ?? []);
    for (const row of source.get(table) ?? []) {
      const key = identity(table, row);
      const matched = right.get(key);
      if (matched && equalPayload(row, matched)) {
        retain(plan, table, 'source', row);
        plan.duplicates.push({
          table,
          provenance: 'target',
          identity: key,
          raw: matched,
          duplicateOf: { provenance: 'source', identity: key },
        });
        right.delete(key);
      } else retain(plan, table, 'source', row);
    }
    for (const row of right.values()) retain(plan, table, 'target', row);
  }
}

export function projectMergePreview(input: ProjectionInput): ProjectionPlan {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('merge projection input is invalid');
  if (!('source' in input) || !('target' in input))
    throw new Error('merge projection input is incomplete');
  if (!isRecord(input.source) || !isRecord(input.target))
    throw new Error('merge projection source is invalid');
  if (input.source.accountId === input.target.accountId)
    throw new Error('merge projection requires distinct accounts');
  const auxiliary = validateAuxiliary(input.auxiliary);
  const plan: ProjectionPlan = {
    sqlDigests: { source: input.source.snapshot.sqlDigest, target: input.target.snapshot.sqlDigest },
    retained: [],
    duplicates: [],
    conflicts: [],
    requiredSelections: [],
    auxiliaryConnected: false,
    fundamentalsUnions: [],
  };
  projectRows(input, plan);
  addConflicts(plan);
  addFundamentals(plan);
  bindAuxiliary(plan, auxiliary);
  return plan;
}
