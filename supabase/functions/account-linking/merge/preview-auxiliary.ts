import type { AuxiliaryInput, ProjectionPlan } from './types.ts';

export function bindAuxiliary(plan: ProjectionPlan, auxiliary: AuxiliaryInput | undefined) {
  if (!auxiliary) return;
  const exams = plan.retained.filter((row) => row.table === 'exam_sessions');
  for (const choice of auxiliary.examResume ?? []) {
    if (
      !exams.some(
        (row) => row.identity === choice.examId && row.raw.certification_id === choice.certificationId,
      )
    )
      throw new Error('merge projection auxiliary exam choice is unbound');
  }
  const manifests = plan.retained.filter((row) => row.table === 'migration_manifests');
  for (const choice of auxiliary.manifestReplayHeads ?? []) {
    if (
      !manifests.some(
        (row) =>
          row.identity === choice.manifestId &&
          row.raw.source_name === choice.sourceName &&
          row.raw.source_fingerprint === choice.sourceFingerprint,
      )
    )
      throw new Error('merge projection auxiliary manifest choice is unbound');
  }
  plan.auxiliary = auxiliary;
}
