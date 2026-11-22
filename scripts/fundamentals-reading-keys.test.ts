import { expect, test } from 'bun:test';
import { readingBlocks } from '../src/fundamentals/learner/lesson-reading-blocks';
import type { LessonStep } from '../src/fundamentals/delivery/slideTypes';

test('split paragraph fragments keep unique stable identities through translation and unrelated insertions', () => {
  const block: LessonStep['blocks'][number] = {
    kind: 'paragraph',
    label: '',
    text: 'First fragment',
    contentRef: 'section:tradeoffs:paragraph:3',
  };
  const step = { id: 'slide-1', blocks: [block, { ...block, text: 'Second fragment' }] };
  const original = readingBlocks(step).map(({ key }) => key);
  expect(new Set(original).size).toBe(2);
  const translated = {
    ...step,
    blocks: step.blocks.map((item) => ({ ...item, text: `訳：${item.text}` })),
  };
  expect(readingBlocks(translated).map(({ key }) => key)).toEqual(original);
  const inserted = {
    ...step,
    blocks: [block, { ...block, contentRef: 'other:paragraph:1' }, step.blocks[1]],
  };
  expect(
    readingBlocks(inserted)
      .filter(({ block: item }) => item.contentRef === block.contentRef)
      .map(({ key }) => key),
  ).toEqual(original);
});
