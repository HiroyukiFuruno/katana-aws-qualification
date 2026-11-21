import { expect, test } from 'bun:test';
import type { LessonSlideBlock } from '../src/fundamentals/delivery/slideTypes';
import { lessonFragments } from '../src/fundamentals/learner/lessonFragments';

const block: LessonSlideBlock = {
  kind: 'paragraph',
  contentRef: 'section:a:paragraph:0',
  label: 'A',
  text: 'Repeated text.',
};

test('同じ参照と本文の反復も一意な表示keyで保持する', () => {
  const fragments = lessonFragments({ id: 'step-a', blocks: [block, { ...block }, { ...block }] });
  expect(new Set(fragments.map(({ key }) => key)).size).toBe(3);
  expect(fragments.map(({ block }) => block.text)).toEqual(Array(3).fill(block.text));
});

test('異なる本文や無関係な断片の挿入で既存fragmentのkeyを変えない', () => {
  const other = { ...block, contentRef: 'section:b:paragraph:0', text: 'Other text.' };
  const split = { ...block, text: 'Another fragment of the same paragraph.' };
  const original = lessonFragments({ id: 'step-a', blocks: [block, split, block] });
  const inserted = lessonFragments({ id: 'step-a', blocks: [other, block, split, other, block] });
  expect([inserted[1].key, inserted[2].key, inserted[4].key]).toEqual(original.map(({ key }) => key));
  expect(new Set(inserted.map(({ key }) => key)).size).toBe(inserted.length);
});

test('参照と本文が同じでも別stepの識別子を共有しない', () => {
  const first = lessonFragments({ id: 'step-a', blocks: [block] });
  const second = lessonFragments({ id: 'step-b', blocks: [block] });
  expect(first[0].key).not.toBe(second[0].key);
});
