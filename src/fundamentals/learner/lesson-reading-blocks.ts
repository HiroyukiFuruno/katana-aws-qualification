import type { LessonStep } from '../delivery/slideTypes';

export function readingBlocks(step: Pick<LessonStep, 'id' | 'blocks'>) {
  const occurrences = new Map<string, number>();
  return step.blocks.map((block) => {
    // 同じ原文段落から分割した断片を、翻訳文や別段落の挿入に依存しないキーで区別する。
    const fragment = occurrences.get(block.contentRef) ?? 0;
    occurrences.set(block.contentRef, fragment + 1);
    return { key: `${step.id}:${block.contentRef}:${fragment}`, block };
  });
}
