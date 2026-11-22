import { expect, test } from 'bun:test';
import { projectMergePreview } from '../supabase/functions/account-linking/merge/preview.ts';
import { goldenInput, source } from './account-merge-preview-fixture.test.ts';

function first(rows: Record<string, unknown>[]): Record<string, unknown> {
  const row = rows[0];
  if (!row) throw new Error('golden fixture unexpectedly has no row');
  return row;
}

test('projects both nonempty twelve-table snapshots without losing a raw row', () => {
  const plan = projectMergePreview(goldenInput());
  expect(plan.retained.length + plan.duplicates.length).toBe(24);
  expect(new Set(plan.retained.map((row) => row.table)).size).toBe(12);
  expect(plan.sqlDigests).toEqual({ source: '1'.repeat(64), target: '2'.repeat(64) });
  expect(plan.fundamentalsUnions).toEqual([
    {
      unitId: 'unit',
      contentVersion: 'v1',
      slideIds: ['slide-1', 'slide-2'],
      checkpointIds: ['check-1', 'check-2'],
      continuity: 'review-required',
      observedPositions: [1, 2],
    },
  ]);
  expect(new Set(plan.requiredSelections.map((item) => item.kind))).toEqual(
    new Set(['assessment', 'dashboard', 'exam-resume', 'final-resume', 'manifest-head', 'roadmap']),
  );
  expect(plan.duplicates.map((row) => row.table)).toEqual(['learning_state']);
  expect(plan.conflicts.map((item) => item.kind)).toContain('event-id-remap-required');
  expect(plan.conflicts.map((item) => item.kind)).toContain(
    'certification-earliest-recorded-at-candidate',
  );
});

test('fails closed for same accounts, missing data, unknown columns, and invalid owner binding', () => {
  const cases = [
    () => ({ ...goldenInput(), target: { ...goldenInput().target, accountId: source } }),
    () => {
      const input = goldenInput();
      delete input.source.snapshot.document.tables['public.learning_events'];
      return input;
    },
    () => {
      const input = goldenInput();
      first(
        input.source.snapshot.document.tables['public.learning_events'] as Record<string, unknown>[],
      ).extra = true;
      return input;
    },
    () => {
      const input = goldenInput();
      first(
        input.source.snapshot.document.tables['public.learning_events'] as Record<string, unknown>[],
      ).user_id = '00000000-0000-4000-8000-000000000000';
      return input;
    },
    () => {
      const input = goldenInput();
      input.source.snapshot.document.tables['public.unknown'] = [];
      return input;
    },
    () => ({ ...goldenInput(), auxiliary: { version: 2 } as never }),
  ];
  for (const build of cases) expect(() => projectMergePreview(build())).toThrow();
});

test('rejects duplicate snapshot identities and an unbacked fundamentals pass', () => {
  const duplicate = goldenInput();
  const events = duplicate.target.snapshot.document.tables['public.learning_events'] as Record<
    string,
    unknown
  >[];
  events.push({ ...events[0] });
  expect(() => projectMergePreview(duplicate)).toThrow();
  const unbacked = goldenInput();
  const progress = unbacked.source.snapshot.document.tables[
    'public.fundamentals_unit_progress'
  ] as Record<string, unknown>[];
  first(progress).passed_final_session_id = '00000000-0000-4000-8000-000000000000';
  expect(() => projectMergePreview(unbacked)).toThrow();
});
