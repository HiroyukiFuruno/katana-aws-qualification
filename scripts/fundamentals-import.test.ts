import { expect, test } from 'bun:test';
import { guestLessonPrefix } from '../src/learningStorage';
import { guestProgressConsentKey } from '../src/progress/guest';
import { importGuestLesson, readGuestLessonImport } from '../src/fundamentals/state/importGuestLesson';
import { initialGuestLesson } from '../src/fundamentals/state/guestInitial';
import { guestLessonSnapshot } from '../src/fundamentals/state/guestSnapshot';
import { emptyLessonSnapshot, lessonAsset } from './fundamentals-state-fixture';
import { sourceWithReceipts } from './fundamentals-import-fixture';

const userId = '10000000-0000-4000-8000-000000000001';
const key = `${guestLessonPrefix}${lessonAsset.unit.id}.${lessonAsset.contentVersion}`;

function input(
  raw = JSON.stringify(initialGuestLesson(lessonAsset)),
  generations = [7],
  snapshot = emptyLessonSnapshot(),
) {
  const values = new Map([
    [guestProgressConsentKey, 'granted'],
    [key, raw],
  ]);
  const calls: { args: Record<string, unknown>; name: string }[] = [];
  const client = {
    rpc: async <T>(name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'initialize_learning_state') return (generations.shift() ?? 7) as T;
      if (name === 'begin_migration') return args.p_manifest_id as T;
      if (name === 'import_fundamentals_unit') return snapshot as T;
      return undefined as T;
    },
    select: async <T>() =>
      [
        {
          manifest_id: calls[1]?.args.p_manifest_id,
          source_name: 'fundamentals-progress-local-storage',
          source_fingerprint: calls[1]?.args.p_fingerprint,
          status: 'completed',
        },
      ] as T,
  };
  return {
    calls,
    values,
    value: {
      asset: lessonAsset,
      storage: {
        getItem: (item: string) => values.get(item) ?? null,
        removeItem: (item: string) => void values.delete(item),
        setItem: (item: string, value: string) => void values.set(item, value),
      },
      access: {
        client,
        isCurrent: () => true,
        owner: { kind: 'member' as const, generation: 3, userId },
        refresh: async () => {},
      },
    },
  };
}

test('imports the validated consented source with exact manifest RPC arguments then removes only unchanged raw data', async () => {
  const fixture = input();
  const result = await importGuestLesson(fixture.value);
  expect(result.removed).toBe(true);
  expect(fixture.values.get(key)).toBeUndefined();
  expect(fixture.calls.map((call) => call.name)).toEqual([
    'initialize_learning_state',
    'begin_migration',
    'import_fundamentals_unit',
    'complete_migration',
    'initialize_learning_state',
    'initialize_learning_state',
  ]);
  expect(fixture.calls[1]?.args.p_expected_generation).toBe(7);
  expect(fixture.calls[2]?.args.p_payload).toEqual(initialGuestLesson(lessonAsset));
  expect(fixture.calls[2]?.args.p_source_row_id).toBe(
    `${lessonAsset.unit.id}:${lessonAsset.contentVersion}`,
  );
});

test('retains a changed, corrupt, or non-consented source without claiming success', async () => {
  const changed = input();
  changed.value.access.refresh = async () => changed.values.set(key, 'new-source');
  await expect(importGuestLesson(changed.value)).resolves.toMatchObject({ removed: false });
  expect(changed.values.get(key)).toBe('new-source');
  const corrupt = input('{bad');
  await expect(importGuestLesson(corrupt.value)).rejects.toThrow();
  expect(corrupt.calls).toEqual([]);
  const blocked = input();
  blocked.values.delete(guestProgressConsentKey);
  expect(readGuestLessonImport(blocked.value)).toBeNull();
  await expect(importGuestLesson(blocked.value)).rejects.toThrow('No consented');
});

test('retains the original when the server generation changes or the receipt omits imported progress', async () => {
  const reset = input(undefined, [7, 8]);
  await expect(importGuestLesson(reset.value)).rejects.toThrow('generation changed');
  expect(reset.values.get(key)).not.toBeUndefined();
  const source = initialGuestLesson(lessonAsset);
  const first = lessonAsset.steps[0];
  const next = lessonAsset.steps[1];
  if (!first || !next) throw new Error('Lesson fixture is incomplete.');
  source.completedSlideIds = [first.id];
  source.furthestPlanPosition = 1;
  source.resumeStepId = next.id;
  const missing = input(JSON.stringify(source));
  await expect(importGuestLesson(missing.value)).rejects.toThrow('did not retain');
  expect(missing.values.get(key)).toBe(JSON.stringify(source));
});

test('does not treat a manifest-only mock as proof that checkpoint events were imported', async () => {
  const source = sourceWithReceipts();
  const fixture = input(JSON.stringify(source), [7], guestLessonSnapshot(source, lessonAsset));
  await expect(importGuestLesson(fixture.value)).rejects.toThrow('event receipts');
  expect(fixture.values.get(key)).toBe(JSON.stringify(source));
});
