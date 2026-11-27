import type { Locale } from '../../locales.ts';
import type { LessonStep } from './slideTypes.ts';

const shiftedObjectives = new Set([
  'fundamentals.cloud-concepts:intro:objectives:1',
  'fundamentals.networking-basics:intro:objectives:1',
]);

export function repairLessonFieldOrder(step: LessonStep, locale: Locale): LessonStep {
  const [first, middle, last] = step.blocks;
  if (
    step.id === 'fundamentals.cicd:section:artifacts-promotion:misconception:1' &&
    step.blocks.length === 2 &&
    middle.kind === 'correction' &&
    middle.label.length > middle.text.length
  ) {
    return { ...step, blocks: [first, { ...middle, label: middle.text, text: middle.label }] };
  }
  if (
    step.id === 'fundamentals.cicd:intro:objectives:1' &&
    step.blocks.length === 3 &&
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
  if (
    shiftedObjectives.has(step.id) &&
    step.blocks.length === 3 &&
    middle.label.length > first.label.length * 1.25
  ) {
    return {
      ...step,
      label: first.label,
      blocks: [
        first,
        { ...middle, label: first.label, text: middle.label },
        { ...last, label: first.label, text: middle.text },
      ],
    };
  }
  return repairReadingFieldOrder(step);
}

function repairReadingFieldOrder(step: LessonStep): LessonStep {
  const [first, middle, last] = step.blocks;
  if (step.kind !== 'reading' || !first || !middle || first.label === step.label) return step;

  // 翻訳の見出しに段落が入った場合、各欄の重複を照合して元の順番に戻す。
  const heading = first.label;
  if (step.blocks.length === 2 && middle.label === step.label && middle.text === heading) {
    return {
      ...step,
      label: heading,
      blocks: [first, { ...middle, label: heading, text: middle.label }],
    };
  }
  if (step.blocks.length !== 3 || middle.label === heading || !last) return step;
  const stripPunctuation = (text: string) => text.replace(/[\p{P}\s]+$/u, '');
  const sameHeading = (text: string) => stripPunctuation(text) === stripPunctuation(heading);
  const bodyInHeading = [first.text, middle.label, middle.text].includes(step.label);
  if (
    !bodyInHeading ||
    !sameHeading(last.label) ||
    !(sameHeading(last.text) || last.text === first.text)
  )
    return step;
  return {
    ...step,
    label: heading,
    blocks: [
      first,
      { ...middle, label: heading, text: middle.label },
      { ...last, label: heading, text: middle.text },
    ],
  };
}
