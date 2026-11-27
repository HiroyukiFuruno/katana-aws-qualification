import { expect, test } from 'bun:test';
import { parseDeliveryIndex } from '../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../src/fundamentals/delivery/loadUnit';
import { readLessonRecordAsset, toLessonRecordAsset } from '../src/fundamentals/delivery/recordAsset';

async function firstDeliveryAsset() {
  const index = parseDeliveryIndex(await Bun.file('public/fundamentals/delivery/index.json').json());
  const entry = index.units[0];
  if (!entry) throw new Error('Missing delivery unit.');
  return parseDeliveryUnit(
    await Bun.file(`public/fundamentals/delivery/${entry.slug}.json`).json(),
    entry,
  );
}

test('lesson records retain grading references without lesson content', async () => {
  const asset = await firstDeliveryAsset();
  const record = toLessonRecordAsset(asset);

  expect(record.unit).toEqual({ id: asset.unit.id, title: asset.unit.title });
  expect(record.checkpoints[0]).not.toHaveProperty('prompt');
  expect(record.checkpoints[0]?.choices[0]).toEqual({ id: asset.checkpoints[0]?.choices[0]?.id });
  expect(readLessonRecordAsset(structuredClone(record), asset.unit.id, asset.contentVersion)).toEqual(
    record,
  );
});

test('lesson records reject altered final ordering, references, and grading policy', async () => {
  const asset = await firstDeliveryAsset();
  const record = toLessonRecordAsset(asset);

  const reordered = structuredClone(record);
  reordered.finalQuestions.reverse();
  expect(() => readLessonRecordAsset(reordered, asset.unit.id, asset.contentVersion)).toThrow();

  const invalidCorrect = structuredClone(record);
  const first = invalidCorrect.finalQuestions[0];
  if (!first) throw new Error('Missing final question.');
  first.correct = ['missing'];
  expect(() => readLessonRecordAsset(invalidCorrect, asset.unit.id, asset.contentVersion)).toThrow();

  const invalidPolicy = structuredClone(record);
  invalidPolicy.finalPolicy.passCorrect = invalidPolicy.finalPolicy.questionCount + 1;
  expect(() => readLessonRecordAsset(invalidPolicy, asset.unit.id, asset.contentVersion)).toThrow();
});
