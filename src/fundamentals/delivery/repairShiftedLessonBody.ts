import type { LessonStep } from './slideTypes.ts';

function comparable(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function repairShiftedLessonBody(step: LessonStep): LessonStep {
  if (step.kind !== 'reading' && step.kind !== 'takeaway') return step;
  const previous = step.blocks.at(-2);
  const last = step.blocks.at(-1);
  if (!previous || !last || previous.kind !== last.kind) return step;
  const heading = comparable(step.label);
  const tail = comparable(last.text);
  const lastLabel = comparable(last.label);
  if (
    heading &&
    step.kind === 'reading' &&
    last.kind === 'paragraph' &&
    tail === heading &&
    comparable(previous.label) === heading &&
    lastLabel.length > heading.length * 1.25
  ) {
    // 最終段落の見出しと本文だけが入れ替わっている。
    return {
      ...step,
      blocks: [...step.blocks.slice(0, -1), { ...last, label: last.text, text: last.label }],
    };
  }
  const misplaced = comparable(previous.label);
  const hasHeadingLabel =
    lastLabel === heading || (lastLabel.startsWith(heading) && !lastLabel.replaceAll(heading, ''));
  if (
    !heading ||
    misplaced.length <= heading.length * 1.25 ||
    !hasHeadingLabel ||
    !previous.text.trim()
  ) {
    return step;
  }
  const repeatedHeading = step.kind === 'reading' && last.kind === 'paragraph' && tail === heading;
  const copiedSource =
    step.kind === 'takeaway' &&
    last.kind === 'takeaway' &&
    step.sources.some((source) => comparable(source.label) === tail);
  if (!repeatedHeading && !copiedSource) return step;

  // 翻訳の末尾に見出しまたは出典が入り、直前の見出しに本文が移った場合だけ元に戻す。
  return {
    ...step,
    blocks: [
      ...step.blocks.slice(0, -2),
      { ...previous, label: step.label, text: previous.label },
      { ...last, label: step.label, text: previous.text },
    ],
  };
}
