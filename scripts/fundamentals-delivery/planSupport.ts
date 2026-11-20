import type { DeliveryQuestion } from '../../src/fundamentals/delivery/artifactTypes';
import type { LessonSlideBlock, LessonStep } from '../../src/fundamentals/delivery/slideTypes';
import type { FundamentalsUnit } from '../../src/fundamentals/types';
import { blocks, semanticGroups, type TextWarning } from './text';

export type RawStep = Omit<LessonStep, 'position' | 'remainingSteps' | 'totalSteps'>;
export type Timing = {
  checkpointSeconds: number;
  finalSeconds: number;
  readingSeconds: number;
  totalSeconds: number;
};

type SlideInput = {
  blocks: { contentRef: string; kind: LessonSlideBlock['kind']; label: string; text: string }[];
  complexity?: number;
  id: string;
  kind: LessonStep['kind'];
  label: string;
  objectiveIds?: string[];
  sectionId?: string;
  sources?: { label: string; url: string }[];
  style: LessonStep['style'];
};

function estimate(blocks: LessonSlideBlock[], complexity = 0) {
  const characters = blocks.reduce((total, block) => total + Array.from(block.text).length, 0);
  return Math.max(12, Math.ceil(characters / 6)) + complexity;
}

export function assessmentSeconds(question: DeliveryQuestion, base: number) {
  return base + question.choices.length * 3 + question.requiredChoices * 8;
}

export function objectiveIds(unit: FundamentalsUnit, sectionId: string) {
  return (unit.learningObjectives ?? [])
    .filter((objective) => objective.sectionIds.includes(sectionId))
    .map((objective) => objective.id);
}

export function addSlides(
  target: RawStep[],
  warnings: TextWarning[],
  unit: FundamentalsUnit,
  input: SlideInput,
) {
  const items = input.blocks.flatMap((block) => blocks(block, warnings));
  semanticGroups(items).forEach((group, index, all) => {
    target.push({
      blocks: group,
      estimatedSeconds: estimate(group, input.complexity),
      id: `${input.id}:${index + 1}`,
      kind: input.kind,
      label: input.label,
      objectiveIds: input.objectiveIds ?? [],
      sectionId: input.sectionId,
      sources: index === all.length - 1 ? (input.sources ?? []) : [],
      style: input.style,
      unitId: unit.id,
    });
  });
}

export function complete(steps: RawStep[]) {
  return steps.map((step, index) => ({
    ...step,
    position: index + 1,
    remainingSteps: steps.length - index - 1,
    totalSteps: steps.length,
  }));
}

export function timings(steps: LessonStep[]): Timing {
  const sum = (predicate: (step: LessonStep) => boolean) =>
    steps.filter(predicate).reduce((total, step) => total + step.estimatedSeconds, 0);
  const checkpointSeconds = sum((step) => step.kind === 'checkpoint');
  const finalSeconds = sum((step) => step.kind === 'final');
  const readingSeconds = sum((step) => step.kind !== 'checkpoint' && step.kind !== 'final');
  return {
    checkpointSeconds,
    finalSeconds,
    readingSeconds,
    totalSeconds: readingSeconds + checkpointSeconds + finalSeconds,
  };
}
