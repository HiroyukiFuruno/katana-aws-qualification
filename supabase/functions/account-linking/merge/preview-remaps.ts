import { group } from './preview-values.ts';
import type { ProjectionPlan, RetainedRow } from './types.ts';

export function option(row: RetainedRow) {
  return `${row.provenance}:${row.identity}`;
}

export function remaps(
  plan: ProjectionPlan,
  table: RetainedRow['table'],
  kind: string,
  references: (id: string) => RetainedRow[],
) {
  for (const [id, items] of group(
    plan.retained.filter((row) => row.table === table),
    (row) => row.identity,
  )) {
    if (items.length < 2) continue;
    plan.conflicts.push({
      table,
      kind,
      identities: items.map(option),
      detail: { referenceRows: references(id).map(option) },
    });
  }
}
