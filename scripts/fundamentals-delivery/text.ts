import type { LessonSlideBlock } from '../../src/fundamentals/delivery/slideTypes';

export const blockCharacterTarget = 180;
export const slideCharacterTarget = 320;
export const slideBlockLimit = 3;
export const segmentationPolicy = {
  blockCharacterTarget,
  slideBlockLimit,
  slideCharacterTarget,
  sentenceBoundaries: '。！？!?',
};

export type TextWarning = {
  code: 'dense-slide' | 'long-sentence';
  contentRef?: string;
  stepId?: string;
};

function sentences(text: string) {
  const result: string[] = [];
  let current = '';
  for (const character of text) {
    current += character;
    if (segmentationPolicy.sentenceBoundaries.includes(character)) {
      result.push(current);
      current = '';
    }
  }
  if (current) result.push(current);
  return result;
}

function words(text: string) {
  return [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(text)].filter(
    (part) => part.isWordLike,
  ).length;
}

export function blocks(
  input: Omit<LessonSlideBlock, 'contentRef'> & { contentRef: string },
  warnings: TextWarning[],
) {
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences(input.text)) {
    if (Array.from(sentence).length > blockCharacterTarget) {
      if (current) chunks.push(current);
      chunks.push(sentence);
      current = '';
      warnings.push({ code: 'long-sentence', contentRef: input.contentRef });
    } else if (Array.from(current + sentence).length > blockCharacterTarget) {
      chunks.push(current);
      current = sentence;
    } else current += sentence;
  }
  if (current) chunks.push(current);
  return chunks.map((text) => ({ ...input, text, words: words(text) }));
}

export function semanticGroups(blocks: LessonSlideBlock[]) {
  const groups: LessonSlideBlock[][] = [];
  let current: LessonSlideBlock[] = [];
  let characters = 0;
  for (const block of blocks) {
    const next = characters + Array.from(block.text).length;
    if (current.length && (current.length === slideBlockLimit || next > slideCharacterTarget)) {
      groups.push(current);
      current = [];
      characters = 0;
    }
    current.push(block);
    characters += Array.from(block.text).length;
  }
  if (current.length) groups.push(current);
  return groups;
}
