import { group, textArray } from './preview-values.ts';
import type { ProjectionPlan } from './types.ts';

export function addFundamentals(plan: ProjectionPlan) {
  const finals = new Map(
    [...plan.retained, ...plan.duplicates]
      .filter((row) => row.table === 'fundamentals_final_sessions')
      .map((row) => [`${row.provenance}:${row.identity}`, row.raw]),
  );
  for (const [key, items] of group(
    [...plan.retained, ...plan.duplicates].filter((row) => row.table === 'fundamentals_unit_progress'),
    (row) => row.identity,
  )) {
    const [unitId, contentVersion] = key.split(':');
    if (!unitId || !contentVersion) throw new Error('invalid fundamentals identity');
    for (const item of items) {
      const passed = item.raw.passed_final_session_id;
      const session = finals.get(`${item.provenance}:${String(passed)}`);
      if (
        passed !== null &&
        (session?.state !== 'submitted' ||
          session.passed !== true ||
          session.unit_id !== unitId ||
          session.content_version !== contentVersion ||
          typeof session.submitted_at !== 'string' ||
          typeof session.submitted_received_at !== 'string' ||
          typeof session.submission_hash !== 'string')
      )
        throw new Error('fundamentals pass is not backed by submitted session');
    }
    const retained = items.filter((item) => !('duplicateOf' in item));
    const positions = [...new Set(retained.map((item) => item.raw.furthest_plan_position))];
    plan.conflicts.push({
      table: 'fundamentals_unit_progress',
      kind: 'fundamentals-continuity-review-required',
      identities: [key],
      detail: { observedPositions: positions },
    });
    plan.fundamentalsUnions.push({
      unitId,
      contentVersion,
      slideIds: [
        ...new Set(retained.flatMap((item) => textArray(item.raw, 'completed_slide_ids'))),
      ].sort(),
      checkpointIds: [
        ...new Set(retained.flatMap((item) => textArray(item.raw, 'completed_checkpoint_ids'))),
      ].sort(),
      continuity: 'review-required',
      observedPositions: positions.filter((value): value is number => typeof value === 'number'),
    });
  }
}
