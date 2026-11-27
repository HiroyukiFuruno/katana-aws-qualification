import { expect, spyOn, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { TrustedCatalogUnit, TrustedQuestion } from '../src/fundamentals/delivery/artifactTypes';
import { createLessonAssets } from '../src/fundamentals/delivery/assets';
import legacy from '../src/fundamentals/delivery/legacyRecordAssets.json';
import { readLessonRecordAsset, toLessonRecordAsset } from '../src/fundamentals/delivery/recordAsset';

test('the immutable grading migrations and their retained lesson records agree', async () => {
  const published = [
    [
      '202611200010_fundamentals_catalog.sql',
      'adfe07941da701fd7518780c932de69c3f04614783620a5b7346b76ffca8b588',
    ],
    [
      '202611210001_fundamentals_catalog_revision.sql',
      'ced5b3c019767a1a1fe0e1bf22fb408337a2427c156f58ae141d63beb83145cf',
    ],
  ];
  const readQuestion = (question: TrustedQuestion) => ({
    category: question.category,
    choices: question.choiceIds.map((id) => ({ id })),
    correct: question.correctChoiceIds,
    id: question.questionId,
    requiredChoices: question.requiredChoices,
    revision: question.revision,
    selectionPolarity: question.selectionPolarity,
    version: question.sourceVersion,
  });
  let matched = 0;
  for (const [name, digest] of published) {
    const sql = await readFile(`supabase/migrations/${name}`, 'utf8');
    expect(createHash('sha256').update(sql).digest('hex')).toBe(digest);
    const rows = sql.matchAll(
      /^ {2}\('([^']+)', '([a-f0-9]{64})', decode\('([a-f0-9]{64})', 'hex'\),\n {4}\$kaq_plan_\d+_\d+\$(.*?)\$kaq_plan_\d+_\d+\$::jsonb,\n {4}\$kaq_final_\d+_\d+\$(.*?)\$kaq_final_\d+_\d+\$::jsonb\)/gms,
    );
    for (const [, unitId, version, hash, plan, final] of rows) {
      const record = legacy.assets.find(
        (asset) => asset.unit.id === unitId && asset.contentVersion === version,
      );
      if (!record || !unitId || !version || !plan || !final)
        throw new Error('Missing retained grading data');
      const asset = readLessonRecordAsset(record, unitId, version);
      const trustedPlan: TrustedCatalogUnit['plan'] = JSON.parse(plan);
      const trustedFinal: TrustedCatalogUnit['finalQuestions'] = JSON.parse(final);
      expect(asset.contentHash).toBe(hash);
      expect(asset.steps.filter((step) => step.kind !== 'final').map((step) => step.id)).toEqual(
        trustedPlan.map((step) => step.id),
      );
      expect(asset.checkpoints).toEqual(
        trustedPlan.flatMap((step) => (step.kind === 'checkpoint' ? [readQuestion(step.question)] : [])),
      );
      expect(asset.finalQuestions).toEqual(trustedFinal.map(readQuestion));
      matched++;
    }
  }
  expect(matched).toBe(18);
  expect(legacy.assets).toHaveLength(matched);
});

test('history loads grading data without requesting or exposing retired lesson slides', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    if (!path.startsWith('/fundamentals/delivery/') || path.includes('..') || path.includes('/history/'))
      throw new Error('Unexpected unit-test asset request');
    return new Response(await readFile(`public${path}`, 'utf8'));
  });
  try {
    const assets = createLessonAssets();
    const index = await assets.index();
    for (const entry of legacy.assets) {
      const archived = await assets.record(entry.unit.id, entry.contentVersion);
      if (!archived) throw new Error('Missing history fixture');
      expect(toLessonRecordAsset(archived)).toEqual(
        readLessonRecordAsset(entry, entry.unit.id, entry.contentVersion),
      );
      const current = await assets.unit(entry.unit.id);
      expect(current.contentVersion).toBe(
        index.units.find((unit) => unit.unitId === entry.unit.id)?.contentVersion,
      );
      if (entry.contentVersion !== current.contentVersion) {
        await expect(assets.unit(entry.unit.id, entry.contentVersion)).rejects.toThrow(
          'no longer published',
        );
        expect('blocks' in archived.steps[0]).toBe(false);
      }
    }
    const first = index.units[0];
    if (!first) throw new Error('Missing archived unit');
    expect(await assets.record(first.unitId, '0'.repeat(64))).toBeUndefined();
  } finally {
    fetch.mockRestore();
  }
});
