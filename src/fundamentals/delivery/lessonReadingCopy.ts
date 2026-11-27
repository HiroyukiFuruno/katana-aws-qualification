import type { Locale } from '../../locales.ts';
import labels from './misconception-labels.json' with { type: 'json' };
import type { LessonStep } from './slideTypes.ts';

export function lessonReadingCopy(step: LessonStep, locale: Locale): LessonStep {
  if (step.kind !== 'misconception') return step;
  const local = labels[locale];
  return {
    ...step,
    label: local.heading,
    blocks: step.blocks.map((block) =>
      block.kind === 'misconception' || block.kind === 'correction'
        ? { ...block, label: local[block.kind] }
        : block,
    ),
  };
}
