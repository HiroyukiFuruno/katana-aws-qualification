import type { LessonStep } from '../delivery/slideTypes';

export function lessonFragments(step: Pick<LessonStep, 'id' | 'blocks'>) {
  const occurrences = new Map<string, number>();
  return step.blocks.map((block) => {
    const identity = JSON.stringify([step.id, block.contentRef, block.text]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    // 無関係な断片の挿入で識別子を変えず、同じ本文の反復も別の表示要素として保つ。
    return { block, key: JSON.stringify([identity, occurrence]) };
  });
}
