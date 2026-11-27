import { expect, test } from 'bun:test';
import active from '../public/fundamentals/delivery/index.json';
import compatibility from '../src/fundamentals/delivery/compatibleAnswers.json';
import legacy from '../src/fundamentals/delivery/legacyRecordAssets.json';
import { readLessonRecordAsset } from '../src/fundamentals/delivery/recordAsset';
import { copyCompatibleSelection } from '../src/fundamentals/state/draftAnswerCompatibility';

const questionId = 'fundamentals.testing-quality.checkpoint.quality-gates.v1';
const review = compatibility.units.find(({ questions }) => questions.includes(questionId));
if (!review) throw new Error('Missing reviewed quality gate question');
const original = legacy.assets.find(
  (asset) => asset.unit.id === review.unitId && review.previous.includes(asset.contentVersion),
);
if (!original) throw new Error('Missing previous quality gate');
const asset = readLessonRecordAsset(original, original.unit.id, original.contentVersion);
const previous = asset.checkpoints.find(({ id }) => id === questionId);
if (!previous) throw new Error('Missing previous quality gate question');
const updated = { ...previous, correct: ['A', 'C'] };
const reviewedAliases: Readonly<Record<string, Readonly<Record<string, string>>>> = review.choiceAliases;
const aliases = reviewedAliases[questionId];

test('the quality gate restores the selected meanings after A and B exchange labels', () => {
  expect(copyCompatibleSelection(previous, updated, ['B', 'C'], aliases)).toEqual(['A', 'C']);
  expect(copyCompatibleSelection(previous, updated, ['A', 'C'], aliases)).toEqual(['B', 'C']);
  expect(copyCompatibleSelection(previous, updated, ['B', 'C'])).toBeUndefined();
  expect(previous.correct).toEqual(['B', 'C']);
});

test('compatibility never applies a changed grading rule or an invalid saved selection', () => {
  expect(copyCompatibleSelection(previous, updated, ['B', 'C'], { A: 'A', B: 'A' })).toBeUndefined();
  expect(
    copyCompatibleSelection(
      previous,
      { ...updated, selectionPolarity: 'incorrect' },
      ['B', 'C'],
      aliases,
    ),
  ).toBeUndefined();
  expect(copyCompatibleSelection(previous, updated, ['B', 'B'], aliases)).toBeUndefined();
  expect(copyCompatibleSelection(previous, updated, ['B', 'unknown'], aliases)).toBeUndefined();
});

test('reviewed compatibility applies only to the generated current versions', () => {
  const knownVersions = new Map(
    active.units.map(({ unitId, contentVersion }) => [unitId, contentVersion]),
  );
  for (const unit of compatibility.units) {
    expect(unit.contentVersion, unit.unitId).toBe(knownVersions.get(unit.unitId));
    expect(unit.previous, unit.unitId).not.toContain(unit.contentVersion);
  }
});
