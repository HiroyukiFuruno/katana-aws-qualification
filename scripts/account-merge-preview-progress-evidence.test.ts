import { expect, test } from 'bun:test';
import { projectMergePreview } from '../supabase/functions/account-linking/merge/preview.ts';
import { goldenFirst as first, goldenInput } from './account-merge-preview-fixture.test.ts';

function submitted(final: Record<string, unknown>) {
  final.state = 'submitted';
  final.passed = true;
  final.score = 1;
  final.submitted_at = '2026-01-02T00:00:00Z';
  final.submitted_received_at = '2026-01-02T00:00:00Z';
  final.submission_hash = `\\x${'cc'.repeat(32)}`;
}

function duplicatePassedProgress() {
  const input = goldenInput();
  const sourceProgress = first(input, 'public.fundamentals_unit_progress', 'source');
  const targetProgress = first(input, 'public.fundamentals_unit_progress', 'target');
  const sourceFinal = first(input, 'public.fundamentals_final_sessions', 'source');
  const targetFinal = first(input, 'public.fundamentals_final_sessions', 'target');
  submitted(sourceFinal);
  sourceProgress.passed_final_session_id = sourceFinal.session_id;
  sourceProgress.passed_at = sourceFinal.submitted_at;
  sourceProgress.active_final_session_id = null;
  sourceProgress.resume_stage = 'result';
  Object.assign(targetProgress, sourceProgress, { user_id: input.target.accountId });
  return { input, sourceProgress, sourceFinal, targetFinal };
}

test('rejects a duplicate target progress pass backed only by a same-UUID source final', () => {
  const { input, sourceFinal, targetFinal } = duplicatePassedProgress();
  targetFinal.session_id = sourceFinal.session_id;
  expect(() => projectMergePreview(input)).toThrow(
    'fundamentals pass is not backed by submitted session',
  );
});

test('accepts provenance-matched duplicate progress and keeps its union retained-only', () => {
  const { input, sourceProgress, sourceFinal, targetFinal } = duplicatePassedProgress();
  Object.assign(targetFinal, sourceFinal, { user_id: input.target.accountId });
  const plan = projectMergePreview(input);
  expect(plan.duplicates.some((row) => row.table === 'fundamentals_unit_progress')).toBe(true);
  expect(plan.fundamentalsUnions[0]?.slideIds).toEqual(sourceProgress.completed_slide_ids);
});
