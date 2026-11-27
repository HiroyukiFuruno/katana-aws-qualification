import type { Locale } from '../../locales.ts';
import type { LessonStep } from './slideTypes.ts';

export function repairLessonFieldOrder(step: LessonStep, locale: Locale): LessonStep {
  const [first, middle, last] = step.blocks;
  if (step.blocks.length !== 3) return step;

  if (
    step.id === 'fundamentals.identity-access:section:principal-role:concept:1' &&
    middle.label === step.label &&
    last.text === first.text
  ) {
    return {
      ...step,
      blocks: [
        { ...first, label: step.label },
        { ...middle, text: middle.label },
        { ...last, label: step.label, text: middle.text },
      ],
    };
  }

  if (
    step.id === 'fundamentals.cicd:intro:objectives:1' &&
    last.text === locale &&
    last.label === step.label &&
    middle.label !== step.label
  ) {
    return {
      ...step,
      blocks: [
        first,
        { ...middle, label: step.label, text: middle.label },
        { ...last, text: middle.text },
      ],
    };
  }
  return step;
}
