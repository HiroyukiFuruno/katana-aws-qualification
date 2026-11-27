import type { Locale } from '../../locales.ts';
import headingEdits from './lesson-heading-edits.json' with { type: 'json' };
import labels from './misconception-labels.json' with { type: 'json' };
import japaneseEdits from './release-reading-edits.ja.json' with { type: 'json' };
import translatedRepairs from './release-translation-repairs.json' with { type: 'json' };
import { repairLessonFieldOrder } from './repairLessonFieldOrder.ts';
import { repairShiftedLessonBody } from './repairShiftedLessonBody.ts';
import type { LessonSlideBlock, LessonStep } from './slideTypes.ts';

type TranslationRepair = {
  sourceLabel: string;
  sourceText: string;
  label: string;
  text: string;
};
const japanese = new Map(Object.entries(japaneseEdits));
const headings = new Map(Object.entries(headingEdits));
const repairs: Readonly<Partial<Record<Locale, Record<string, TranslationRepair>>>> = translatedRepairs;
const releaseUnit = 'fundamentals.release-rollback';

export function lessonDisplayText(text: string, locale: Locale, unitId: string) {
  return locale === 'ja' && unitId === releaseUnit ? (japanese.get(text) ?? text) : text;
}

function repairedBlock(block: LessonSlideBlock, locale: Locale) {
  const repair = repairs[locale]?.[block.contentRef];
  // 教材を改訂した後の本文を、過去の表示修正で上書きしない。
  return repair && block.label === repair.sourceLabel && block.text === repair.sourceText
    ? { ...block, label: repair.label, text: repair.text }
    : block;
}

export function lessonReadingCopy(step: LessonStep, locale: Locale): LessonStep {
  const fixed = locale === 'ja' ? step : repairLocalizedLesson(step, locale);
  const edit = headings.get(`${step.unitId}/${step.sectionId}`)?.[locale];
  const newHeading = edit?.source === step.label ? edit.text : fixed.label;
  const heading = step.kind === 'misconception' ? labels[locale].heading : newHeading;
  if (heading === fixed.label && step.kind !== 'misconception' && step.unitId !== releaseUnit)
    return fixed;
  return {
    ...fixed,
    label: heading,
    blocks: fixed.blocks.map((block) => {
      const label =
        block.kind === 'misconception' || block.kind === 'correction'
          ? labels[locale][block.kind]
          : block.label === fixed.label
            ? heading
            : block.label;
      return { ...block, label, text: lessonDisplayText(block.text, locale, step.unitId) };
    }),
  };
}

function repairLocalizedLesson(original: LessonStep, locale: Locale) {
  const step = repairLessonFieldOrder(original, locale);
  if (step.unitId !== releaseUnit) return repairShiftedLessonBody(step);
  return repairShiftedLessonBody({
    ...step,
    blocks: step.blocks.map((block) => repairedBlock(block, locale)),
  });
}
