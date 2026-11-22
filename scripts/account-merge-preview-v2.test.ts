import { expect, test } from 'bun:test';
import { projectMergePreview } from '../supabase/functions/account-linking/merge/preview.ts';
import { goldenFirst as first, goldenInput } from './account-merge-preview-fixture.test.ts';

test('does not prove a source pass from a target final with the same session ID', () => {
  const input = goldenInput();
  const sourceFinal = first(input, 'public.fundamentals_final_sessions', 'source');
  const targetFinal = first(input, 'public.fundamentals_final_sessions', 'target');
  first(input, 'public.fundamentals_unit_progress', 'source').passed_final_session_id =
    sourceFinal.session_id;
  targetFinal.session_id = sourceFinal.session_id;
  targetFinal.state = 'submitted';
  targetFinal.passed = true;
  targetFinal.submitted_at = '2026-01-02T00:00:00Z';
  targetFinal.submitted_received_at = '2026-01-02T00:00:00Z';
  targetFinal.submission_hash = '\\xcc';
  expect(() => projectMergePreview(input)).toThrow();
  const wrongUnit = goldenInput();
  const progress = first(wrongUnit, 'public.fundamentals_unit_progress', 'source');
  const final = first(wrongUnit, 'public.fundamentals_final_sessions', 'source');
  progress.passed_final_session_id = final.session_id;
  final.unit_id = 'other-unit';
  final.state = 'submitted';
  final.passed = true;
  final.submitted_at = '2026-01-02T00:00:00Z';
  final.submitted_received_at = '2026-01-02T00:00:00Z';
  final.submission_hash = '\\xcc';
  expect(() => projectMergePreview(wrongUnit)).toThrow();
});

test('keeps provenance-distinct collision choices and declares each remap', () => {
  const input = goldenInput();
  const pairs = [
    ['public.exam_sessions', 'exam_id'],
    ['public.fundamentals_final_sessions', 'session_id'],
    ['public.migration_manifests', 'manifest_id'],
  ] as const;
  for (const [table, field] of pairs)
    first(input, table, 'target')[field] = first(input, table, 'source')[field];
  first(input, 'public.exam_responses', 'target').exam_id = first(
    input,
    'public.exam_sessions',
    'source',
  ).exam_id;
  first(input, 'public.fundamentals_unit_progress', 'target').active_final_session_id = first(
    input,
    'public.fundamentals_final_sessions',
    'source',
  ).session_id;
  first(input, 'public.migration_items', 'target').manifest_id = first(
    input,
    'public.migration_manifests',
    'source',
  ).manifest_id;
  const plan = projectMergePreview(input);
  expect(plan.conflicts.map((item) => item.kind)).toEqual(
    expect.arrayContaining([
      'exam-id-remap-required',
      'final-session-id-remap-required',
      'manifest-id-remap-required',
    ]),
  );
  for (const selection of plan.requiredSelections)
    expect(new Set(selection.options).size).toBe(selection.options.length);
  const examRemap = plan.conflicts.find((item) => item.kind === 'exam-id-remap-required');
  expect(examRemap?.detail.referenceRows).toContain('target:33333333-3333-4333-8333-333333333331:q');
});

test('fails closed for zero account, malformed used values, and unbound auxiliary IDs', () => {
  const invalid = [
    () => {
      const input = goldenInput();
      input.source.accountId = '00000000-0000-0000-0000-000000000000';
      input.source.snapshot.document.accounts[0] = input.source.accountId;
      for (const table of Object.values(input.source.snapshot.document.tables))
        if (Array.isArray(table))
          for (const row of table)
            if (row && typeof row === 'object' && !Array.isArray(row) && 'user_id' in row)
              (row as Record<string, unknown>).user_id = input.source.accountId;
      return input;
    },
    () => {
      const input = goldenInput();
      first(input, 'public.learning_state', 'source').generation = '0';
      return input;
    },
    () => {
      const input = goldenInput();
      first(input, 'public.earned_certifications', 'source').recorded_at = 'not-a-time';
      return input;
    },
    () => ({
      ...goldenInput(),
      auxiliary: {
        version: 1,
        examResume: [{ certificationId: 'missing', examId: 'missing', extra: 'x' }],
      } as never,
    }),
  ];
  for (const build of invalid) expect(() => projectMergePreview(build())).toThrow();
  const input = goldenInput();
  input.auxiliary = { version: 1, examResume: [{ certificationId: 'cert', examId: 'missing' }] };
  expect(() => projectMergePreview(input)).toThrow();
});

test('retains only bound auxiliary candidates without connecting a write path', () => {
  const input = goldenInput();
  const exam = first(input, 'public.exam_sessions', 'source');
  const manifest = first(input, 'public.migration_manifests', 'target');
  input.auxiliary = {
    version: 1,
    examResume: [{ certificationId: String(exam.certification_id), examId: String(exam.exam_id) }],
    manifestReplayHeads: [
      {
        sourceName: String(manifest.source_name),
        sourceFingerprint: String(manifest.source_fingerprint),
        manifestId: String(manifest.manifest_id),
      },
    ],
  };
  const plan = projectMergePreview(input);
  expect(plan.auxiliary).toEqual(input.auxiliary);
  expect(plan.auxiliaryConnected).toBeFalse();
});
